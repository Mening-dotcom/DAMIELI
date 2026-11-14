// Job aggregator. Runs every available source in parallel, with a per-source
// timeout so one slow/broken site never blocks the rest. Then normalizes,
// dedupes, filters (seniority / modality), and returns newest-first.
import type { NormalizedJob } from './types'
import { fetchMentorhoodJobs } from './mentorhood'
import { fetchRemoteOkJobs } from './remoteok'
import { fetchJobicyJobs } from './jobicy'
import { fetchHimalayasJobs } from './himalayas'
import { fetchGetOnBoardJobs, fetchGetOnBoardCategoryJobs } from './getonbrd'
import { fetchTheMuseJobs } from './themuse'
import { fetchJSearchJobs } from './jsearch' // key-gated
import { fetchAdzunaJobs } from './adzuna' // key-gated
import { inferEligibility } from './util'
import { expandRoleTerms } from './synonyms'
import { upsertJobPool, getPoolJobs } from '@/lib/db'

// LATAM/local boards — their jobs are applyable for a Costa Rica resident even
// when "onsite", so they bypass the remote-only modality filter.
const LATAM_SOURCES = new Set(['getonbrd', 'mentorhood'])

export type AggregateFilters = { locationType?: string; seniority?: string; roles?: string[] }

const PER_SOURCE_TIMEOUT_MS = 9000
const MAX_RESULTS = 800

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

// NOTE: 'manager' is deliberately NOT here — 'Community Manager' and 'Customer
// Success Manager' are entry-level titles; including it hid them all at Junior.
const SENIOR = /\b(senior|sr|lead|principal|staff|director|head|vp|architect|expert)\b/i
const JUNIOR = /\b(junior|jr|entry|intern|trainee|associate|graduate|assistant)\b/i

export async function aggregateJobs(filters: AggregateFilters): Promise<{ jobs: NormalizedJob[]; sourceErrors: string[]; sources: number }> {
  const seniority = filters.seniority || 'Junior'
  const remote = filters.locationType === 'remote'
  // The roles the user actually wants (from Settings). Each term is searched
  // across the query-driven sources so the pool matches their field — not a
  // hardcoded "developer". Capped to keep the fan-out reasonable.
  const roleTerms = (filters.roles && filters.roles.length ? filters.roles : ['developer'])
    .map((r) => r.trim()).filter(Boolean).slice(0, 10)

  type Task = { name: string; run: () => Promise<NormalizedJob[]> }
  // Broad feeds (no search term) — fetched once, narrowed later by role keywords.
  const tasks: Task[] = [
    { name: 'mentorhood', run: () => fetchMentorhoodJobs({ locationType: filters.locationType as any, seniority: seniority as any }) },
    { name: 'jobicy', run: () => fetchJobicyJobs({ count: 50 }) },
    // Jobicy LATAM feed: jobs explicitly open to Latin-America applicants.
    { name: 'jobicy:latam', run: () => fetchJobicyJobs({ count: 50, geo: 'latam' }) },
    { name: 'remoteok', run: () => fetchRemoteOkJobs() },
    { name: 'himalayas', run: () => fetchHimalayasJobs({ limit: 100 }) },
    { name: 'themuse', run: () => fetchTheMuseJobs({ pages: 6 }) },
    // Whole customer-support category on the LATAM board — every posting, not
    // just the ones matching a search term.
    { name: 'getonbrd:cat:customer-support', run: () => fetchGetOnBoardCategoryJobs({ category: 'customer-support', perPage: 50, pages: 2 }) },
    // Dedicated Costa-Rica sweep on the LATAM board, independent of role terms,
    // so local-friendly roles are never missed just because of the role list.
    { name: 'getonbrd:costa-rica', run: () => fetchGetOnBoardJobs({ query: 'costa rica', perPage: 50, pages: 2 }) },
  ]
  // Query-driven sources: the user's few seed terms expand into whole job-title
  // FAMILIES (EN + ES) — "help desk" also searches "service desk", "desktop
  // support", "soporte técnico", "mesa de ayuda"… so a job never escapes just
  // because a company picked a different name for the same work.
  const expandedTerms = expandRoleTerms(roleTerms)
  for (const term of expandedTerms) {
    tasks.push({ name: `getonbrd:${term}`, run: () => fetchGetOnBoardJobs({ query: term, perPage: 50, pages: 2 }) })
  }
  // Key-gated aggregator (LinkedIn/Indeed/Glassdoor via JSearch). Small free
  // quota → exactly TWO targeted calls per refresh: the user's top roles, and
  // the same roles biased toward Costa Rica / LATAM inventory.
  if (process.env.RAPIDAPI_KEY) {
    const top = roleTerms.slice(0, 3).join(' OR ')
    tasks.push({ name: 'jsearch', run: () => fetchJSearchJobs({ query: top, remote, seniority }) })
    tasks.push({ name: 'jsearch:latam', run: () => fetchJSearchJobs({ query: `(${top}) costa rica OR latin america`, remote: true, seniority }) })
  }
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    for (let t = 0; t < Math.min(roleTerms.length, 3); t++) {
      const term = roleTerms[t]
      tasks.push({ name: `adzuna:${term}`, run: () => fetchAdzunaJobs({ what: term, remote, pages: 2 }) })
    }
  }

  // The accumulating pool runs alongside the live fetch: boards only show
  // their newest ~100 postings, so recent pool rows (seen in the last 30 days)
  // are merged back in. URL dedupe below keeps the LIVE version when both exist.
  const [settled, poolJobs] = await Promise.all([
    Promise.allSettled(tasks.map((t) => withTimeout(t.run(), PER_SOURCE_TIMEOUT_MS))),
    getPoolJobs().catch(() => []),
  ])

  const all: NormalizedJob[] = []
  const sourceErrors: string[] = []
  const okSources = new Set<string>()
  settled.forEach((r, i) => {
    const base = tasks[i].name.split(':')[0] // collapse per-term tasks to one source name
    if (r.status === 'fulfilled' && Array.isArray(r.value)) { all.push(...r.value); okSources.add(base) }
    else if (r.status === 'rejected') sourceErrors.push(`${base}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`)
  })
  const sources = okSources.size
  const liveCount = all.length
  for (const p of poolJobs) {
    all.push({ source: p.source, title: p.title, company: p.company, description: p.description, remoteType: (p.remoteType as NormalizedJob['remoteType']) || 'unknown', location: p.location, salaryText: p.salaryText, postedAt: p.postedAt, url: p.url })
  }

  // Drop junk + dedupe. Primary key is the URL (unique per posting). A
  // title+company key is used ONLY when the company name is real — GetOnBoard
  // returns no company ('See listing'), and deduping on that deleted ~11% of
  // its jobs whenever two companies posted the same title.
  const seenUrl = new Set<string>()
  const seenTitleCo = new Set<string>()
  const deduped = all.filter((j) => {
    if (!j.title || !j.url) return false
    const url = j.url.trim()
    if (seenUrl.has(url)) return false
    seenUrl.add(url)
    const company = (j.company || '').toLowerCase().replace(/\s+/g, ' ').trim()
    if (company && company !== 'see listing' && company !== 'unknown') {
      const key = j.title.toLowerCase().replace(/\s+/g, ' ').trim() + '|' + company
      if (seenTitleCo.has(key)) return false // same job cross-posted on two boards
      seenTitleCo.add(key)
    }
    return true
  })

  // Tag each job with eligibility (can a LATAM applicant apply?).
  const tagged = deduped.map((j) => ({ ...j, eligibility: inferEligibility(j.location, j.description, j.source) }))

  // Persist this fetch's LIVE jobs into the pool (awaited — a serverless
  // function can freeze right after the response, losing fire-and-forget
  // writes). Every user's refresh makes the shared pool bigger for everyone.
  const liveUrls = new Set(all.slice(0, liveCount).map((j) => j.url))
  await upsertJobPool(tagged.filter((j) => liveUrls.has(j.url)).map((j) => ({
    url: j.url, source: j.source, title: j.title, company: j.company, description: j.description,
    location: j.location, remoteType: j.remoteType || 'unknown', eligibility: j.eligibility || 'unknown',
    salaryText: j.salaryText ?? null, postedAt: j.postedAt ?? null,
  }))).catch(() => { /* pool is best-effort */ })

  // Soft seniority filter: when Junior, drop clearly-senior titles.
  let jobs = tagged
  if (seniority === 'Junior') {
    jobs = tagged.filter((j) => !SENIOR.test(j.title) || JUNIOR.test(j.title))
  }
  // Modality filter: when the user picked Remote, keep remote/unknown — but
  // always keep LATAM/local boards (applyable from Costa Rica even if onsite).
  if (remote) jobs = jobs.filter((j) => j.remoteType === 'remote' || j.remoteType === 'unknown' || LATAM_SOURCES.has(j.source))

  // Applyable-from-Costa-Rica first, newest within each group — BEFORE the cap,
  // so country-restricted jobs never crowd eligible ones out of the 400.
  const rank: Record<string, number> = { latam: 0, worldwide: 1, unknown: 2, us_only: 3, restricted: 4 }
  jobs.sort((a, b) => {
    const r = (rank[a.eligibility || 'unknown'] ?? 2) - (rank[b.eligibility || 'unknown'] ?? 2)
    if (r !== 0) return r
    return String(b.postedAt || '').localeCompare(String(a.postedAt || ''))
  })

  return { jobs: jobs.slice(0, MAX_RESULTS), sourceErrors, sources }
}
