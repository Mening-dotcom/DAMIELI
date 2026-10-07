// Adzuna — aggregates many job boards across the US and globally. Requires free
// env ADZUNA_APP_ID + ADZUNA_APP_KEY. Returns nothing if the keys are absent.
import type { NormalizedJob } from './types'
import { stripHtml, salaryRange } from './util'

export async function fetchAdzunaJobs(opts: { what?: string; country?: string } = {}): Promise<NormalizedJob[]> {
  const id = process.env.ADZUNA_APP_ID
  const key = process.env.ADZUNA_APP_KEY
  if (!id || !key) return []
  const country = (opts.country || 'us').toLowerCase()
  const what = encodeURIComponent(opts.what || 'developer')
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${id}&app_key=${key}&what=${what}&results_per_page=30&content-type=application/json`
  const res = await fetch(url, { headers: { 'User-Agent': 'DAMIELI personal job-search tool' }, cache: 'no-store' })
  if (!res.ok) throw new Error(`Adzuna fetch failed: ${res.status}`)
  const data = await res.json()
  const rows: any[] = Array.isArray(data && data.results) ? data.results : []
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
