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

export type AggregateFilters = { locationType?: string; seniority?: string }

const PER_SOURCE_TIMEOUT_MS = 7000
const MAX_RESULTS = 150

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
  const q = seniority.toLowerCase()
  const remote = filters.locationType === 'remote'

  const tasks: { name: string; run: () => Promise<NormalizedJob[]> }[] = [
    { name: 'mentorhood', run: () => fetchMentorhoodJobs({ locationType: filters.locationType as any, seniority: seniority as any }) },
    { name: 'getonbrd', run: () => fetchGetOnBoardJobs({ query: 'developer', perPage: 30 }) },
    { name: 'remotive', run: () => fetchRemotiveJobs({ search: q, limit: 40 }) },
    { name: 'arbeitnow', run: () => fetchArbeitnowJobs() },
    { name: 'jobicy', run: () => fetchJobicyJobs({ count: 40 }) },
    { name: 'himalayas', run: () => fetchHimalayasJobs({ limit: 40 }) },
    { name: 'themuse', run: () => fetchTheMuseJobs({ page: 1 }) },
  ]
  // Tier B — only when the user has configured the free keys in env.
  if (process.env.RAPIDAPI_KEY) tasks.push({ name: 'jsearch', run: () => fetchJSearchJobs({ query: q + ' developer', remote }) })
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) tasks.push({ name: 'adzuna', run: () => fetchAdzunaJobs({ what: q + ' developer' }) })

  const settled = await Promise.allSettled(tasks.map((t) => withTimeout(t.run(), PER_SOURCE_TIMEOUT_MS)))

  const all: NormalizedJob[] = []
  const sourceErrors: string[] = []
  let sources = 0
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) { all.push(...r.value); sources++ }
    else if (r.status === 'rejected') sourceErrors.push(`${tasks[i].name}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`)
  })

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
