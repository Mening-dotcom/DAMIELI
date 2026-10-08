// JSearch (RapidAPI) — aggregates Google for Jobs (LinkedIn, Indeed, Glassdoor,
// ZipRecruiter, …). Requires a free RapidAPI key in env RAPIDAPI_KEY AND a
// payment method on the RapidAPI account (RapidAPI rejects real server calls
// otherwise, even on the free plan — the Playground still works, which is
// confusing). If the key is absent, or any call fails, this source quietly
// returns nothing so it never blocks or clutters the feed.
import type { NormalizedJob } from './types'
import { stripHtml, salaryRange } from './util'

export async function fetchJSearchJobs(opts: { query?: string; remote?: boolean; seniority?: string } = {}): Promise<NormalizedJob[]> {
  const key = process.env.RAPIDAPI_KEY
  if (!key) return []
  const query = encodeURIComponent((opts.query || 'developer') + (opts.remote ? ' remote' : ''))
  const host = (process.env.RAPIDAPI_JSEARCH_HOST || 'jsearch.p.rapidapi.com').trim()
  const url = `https://${host}/search?query=${query}&page=1&num_pages=1`
  try {
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': host,
        'User-Agent': 'DAMIELI personal job-search tool',
      },
      cache: 'no-store',
    })
    if (!res.ok) return [] // skip silently (e.g. 404/403 when the account isn't provisioned)
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
  } catch {
    return []
  }
}
