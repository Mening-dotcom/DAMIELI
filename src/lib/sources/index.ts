// Job aggregator. Runs every available source in parallel, with a per-source
// timeout so one slow/broken site never blocks the rest. Then normalizes,
// dedupes, filters (seniority / modality), and returns newest-first.
import type { NormalizedJob } from './types'
import { fetchMentorhoodJobs } from './mentorhood'
import { fetchRemotiveJobs } from './remotive'
import { fetchArbeitnowJobs } from './arbeitnow'
import { fetchJobicyJobs } from './jobicy'
import { fetchHimalayasJobs } from './himalayas'
import { fetchGetOnBoardJobs } from './getonbrd'
import { fetchTheMuseJobs } from './themuse'
import { fetchJSearchJobs } from './jsearch' // key-gated
import { fetchAdzunaJobs } from './adzuna' // key-gated
import { inferEligibility } from './util'

export type AggregateFilters = { locationType?: string; seniority?: string; roles?: string[] }

const PER_SOURCE_TIMEOUT_MS = 7000
const MAX_RESULTS = 400

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

const SENIOR = /\b(senior|sr|lead|principal|staff|director|head|vp|architect|manager|expert)\b/i
const JUNIOR = /\b(junior|jr|entry|intern|trainee|associate|graduate|assistant)\b/i

export async function aggregateJobs(filters: AggregateFilters): Promise<{ jobs: NormalizedJob[]; sourceErrors: string[]; sources: number }> {
  const seniority = filters.seniority || 'Junior'
  const remote = filters.locationType === 'remote'
  // The roles the user actually wants (from Settings). Each term is searched
  // across the query-driven sources so the pool matches their field — not a
  // hardcoded "developer". Capped to keep the fan-out reasonable.
  const roleTerms = (filters.roles && filters.roles.length ? filters.roles : ['developer'])
    .map((r) => r.trim()).filter(Boolean).slice(0, 5)

  type Task = { name: string; run: () => Promise<NormalizedJob[]> }
  // Broad feeds (no search term) — fetched once, narrowed later by role keywords.
  const tasks: Task[] = [
    { name: 'mentorhood', run: () => fetchMentorhoodJobs({ locationType: filters.locationType as any, seniority: seniority as any }) },
    { name: 'arbeitnow', run: () => fetchArbeitnowJobs() },
    { name: 'jobicy', run: () => fetchJobicyJobs({ count: 50 }) },
    { name: 'himalayas', run: () => fetchHimalayasJobs({ limit: 100 }) },
    { name: 'themuse', run: () => fetchTheMuseJobs({ pages: 4 }) },
  ]
  // Query-driven sources: one search per role term, so each field is covered.
  for (let t = 0; t < roleTerms.length; t++) {
    const term = roleTerms[t]
    tasks.push({ name: `getonbrd:${term}`, run: () => fetchGetOnBoardJobs({ query: term, perPage: 50 }) })
    tasks.push({ name: `remotive:${term}`, run: () => fetchRemotiveJobs({ search: term, limit: 100 }) })
  }
  // Key-gated aggregators (LinkedIn/Indeed via JSearch, etc.). JSearch has a
  // small free quota, so we send ONE combined query instead of one per term.
  if (process.env.RAPIDAPI_KEY) tasks.push({ name: 'jsearch', run: () => fetchJSearchJobs({ query: roleTerms.slice(0, 3).join(' OR '), remote }) })
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) tasks.push({ name: 'adzuna', run: () => fetchAdzunaJobs({ what: roleTerms[0] }) })

  const settled = await Promise.allSettled(tasks.map((t) => withTimeout(t.run(), PER_SOURCE_TIMEOUT_MS)))

  const all: NormalizedJob[] = []
  const sourceErrors: string[] = []
  const okSources = new Set<string>()
  settled.forEach((r, i) => {
    const base = tasks[i].name.split(':')[0] // collapse per-term tasks to one source name
    if (r.status === 'fulfilled' && Array.isArray(r.value)) { all.push(...r.value); okSources.add(base) }
    else if (r.status === 'rejected') sourceErrors.push(`${base}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`)
  })
  const sources = okSources.size

  // Drop junk + dedupe by title+company.
  const seen = new Set<string>()
  const deduped = all.filter((j) => {
    if (!j.title || !j.url) return false
    const key = (j.title + '|' + j.company).toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Tag each job with eligibility (can a LATAM applicant apply?).
  const tagged = deduped.map((j) => ({ ...j, eligibility: inferEligibility(j.location, j.description, j.source) }))

  // Soft seniority filter: when Junior, drop clearly-senior titles.
  let jobs = tagged
  if (seniority === 'Junior') {
    jobs = tagged.filter((j) => !SENIOR.test(j.title) || JUNIOR.test(j.title))
  }
  // Modality filter: when the user picked Remote, keep remote/unknown only.
  if (remote) jobs = jobs.filter((j) => j.remoteType === 'remote' || j.remoteType === 'unknown')

  // Newest first (best-effort on mixed date formats).
  jobs.sort((a, b) => String(b.postedAt || '').localeCompare(String(a.postedAt || '')))

  return { jobs: jobs.slice(0, MAX_RESULTS), sourceErrors, sources }
}
