// JSearch (RapidAPI) — aggregates Google for Jobs (LinkedIn, Indeed, Glassdoor,
// ZipRecruiter, …). Requires a free RapidAPI key in env RAPIDAPI_KEY. If the key
// is absent this source simply returns nothing (it won't be called by the
// aggregator unless the key exists).
import type { NormalizedJob } from './types'
import { stripHtml, salaryRange } from './util'

export async function fetchJSearchJobs(opts: { query?: string; remote?: boolean; seniority?: string } = {}): Promise<NormalizedJob[]> {
  const key = process.env.RAPIDAPI_KEY
  if (!key) return []
  const query = encodeURIComponent((opts.query || 'developer') + (opts.remote ? ' remote' : ''))
  // remote_jobs_only trims the pool to actual remote postings — the only kind
  // applyable from Costa Rica. num_pages=1 keeps us inside the free 200/mo quota.
  // Which JSearch host to call. Defaults to the canonical letscrape one, but can
  // be overridden (RAPIDAPI_JSEARCH_HOST) if the user subscribed to a clone that
  // lives at a different host — the X-RapidAPI-Host header must match it exactly.
  const host = (process.env.RAPIDAPI_JSEARCH_HOST || 'jsearch.p.rapidapi.com').trim()
  // Minimal param set that matches the working Playground call (query + paging).
  // Remote intent is carried in the query text, not a plan-gated param.
  const url = `https://${host}/search?query=${query}&page=1&num_pages=1`
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': key,
      'X-RapidAPI-Host': host,
      'User-Agent': 'DAMIELI personal job-search tool',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    let body = ''
    try { body = (await res.text()).slice(0, 200) } catch { /* ignore */ }
    // Diagnostics only — host + path + key SHAPE (never the key itself).
    const h = res.headers
    const hdr = `server=${h.get('server') || '?'} rl-limit=${h.get('x-ratelimit-requests-limit') || 'none'} rl-remain=${h.get('x-ratelimit-requests-remaining') || 'none'} region=${h.get('x-rapidapi-region') || '?'}`
    const diag = `head=${key.slice(0, 4)} tail=${key.slice(-4)} | ${hdr}`
    throw new Error(`JSearch fetch failed: ${res.status} [${diag}] ${body}`)
  }
  const data = await res.json()
  const rows: any[] = Array.isArray(data && data.data) ? data.data : []
  return rows.map((j: any) => {
    const loc = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ')
    return {
      source: 'jsearch',
      title: String(j.job_title || 'Untitled role'),
      company: String(j.employer_name || 'Unknown'),
      description: stripHtml(j.job_description),
      remoteType: j.job_is_remote ? ('remote' as const) : ('onsite' as const),
      location: j.job_is_remote ? 'Remote' : loc,
      salaryText: salaryRange(j.job_min_salary, j.job_max_salary, j.job_salary_currency || 'USD'),
      postedAt: j.job_posted_at_datetime_utc ? String(j.job_posted_at_datetime_utc) : null,
      url: String(j.job_apply_link || 'https://www.google.com/search?q=jobs'),
    }
  })
}
