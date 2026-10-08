// Adzuna — aggregates many job boards across the US and globally. Requires free
// env ADZUNA_APP_ID + ADZUNA_APP_KEY. Returns nothing if the keys are absent.
// We append "remote" to the query and pull several pages so it actually feeds
// remote-applyable roles (plain US queries return mostly onsite jobs that the
// aggregator's remote filter would drop).
import type { NormalizedJob } from './types'
import { stripHtml, salaryRange } from './util'

export async function fetchAdzunaJobs(opts: { what?: string; country?: string; remote?: boolean; pages?: number } = {}): Promise<NormalizedJob[]> {
  const id = process.env.ADZUNA_APP_ID
  const key = process.env.ADZUNA_APP_KEY
  if (!id || !key) return []
  const country = (opts.country || 'us').toLowerCase()
  const term = (opts.what || 'developer') + (opts.remote ? ' remote' : '')
  const what = encodeURIComponent(term)
  const pages = Math.min(Math.max(opts.pages || 1, 1), 3)
  const nums: number[] = []
  for (let p = 1; p <= pages; p++) nums.push(p)

  const perPage = await Promise.all(nums.map(async (p) => {
    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${p}?app_id=${id}&app_key=${key}&what=${what}&results_per_page=50&content-type=application/json`
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'DAMIELI personal job-search tool' }, cache: 'no-store' })
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data && data.results) ? data.results : []
    } catch {
      return []
    }
  }))
  const rows = perPage.reduce((acc: any[], r: any[]) => acc.concat(r), [])
  return rows.map((j: any) => ({
    source: 'adzuna',
    title: String(j.title || 'Untitled role'),
    company: j.company && j.company.display_name ? String(j.company.display_name) : 'Unknown',
    description: stripHtml(j.description),
    remoteType: /remote/i.test(String(j.title || '') + ' ' + String(j.description || '')) ? ('remote' as const) : ('onsite' as const),
    location: j.location && j.location.display_name ? String(j.location.display_name) : '',
    salaryText: salaryRange(j.salary_min, j.salary_max, 'USD'),
    postedAt: j.created ? String(j.created) : null,
    url: String(j.redirect_url || 'https://www.adzuna.com'),
  }))
}
