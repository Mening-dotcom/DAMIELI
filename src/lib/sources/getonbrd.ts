// GetOnBoard (getonbrd.com) — Latin-America tech jobs board. JSON:API format.
// Verified: data[].{ id, attributes:{ title, remote, remote_modality, min_salary,
//   max_salary, description, published_at(unix), remote_zone, countries[] },
//   links:{ public_url } }  — company is only an id reference, so we leave it blank.
// Paginated: we pull several pages in parallel for more (and more varied) jobs.
import type { NormalizedJob } from './types'
import { stripHtml, salaryRange, unixToIso } from './util'

export async function fetchGetOnBoardJobs(opts: { query?: string; perPage?: number; pages?: number } = {}): Promise<NormalizedJob[]> {
  const query = encodeURIComponent(opts.query || 'developer')
  const perPage = opts.perPage || 50
  const pages = Math.min(Math.max(opts.pages || 1, 1), 3)
  const nums: number[] = []
  for (let p = 1; p <= pages; p++) nums.push(p)

  const perPageRows = await Promise.all(nums.map(async (p) => {
    try {
      const res = await fetch(`https://www.getonbrd.com/api/v0/search/jobs?query=${query}&per_page=${perPage}&page=${p}`, {
        headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
        cache: 'no-store',
      })
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data && data.data) ? data.data : []
    } catch {
      return []
    }
  }))
  const rows = perPageRows.reduce((acc: any[], r: any[]) => acc.concat(r), [])
  return rows.map((j: any) => {
    const a = j.attributes || {}
    const remote = a.remote === true || /remote/i.test(String(a.remote_modality || ''))
    const countries = Array.isArray(a.countries) ? a.countries.filter(Boolean).join(', ') : ''
    const url = j.links && j.links.public_url ? String(j.links.public_url) : 'https://www.getonbrd.com'
    return {
      source: 'getonbrd',
      title: String(a.title || 'Untitled role'),
      company: 'See listing',
      description: stripHtml(a.description),
      remoteType: remote ? ('remote' as const) : ('onsite' as const),
      location: String(a.remote_zone || countries || 'LATAM'),
      salaryText: salaryRange(a.min_salary, a.max_salary, 'USD'),
      postedAt: unixToIso(a.published_at),
      url,
    }
  })
}
