// GetOnBoard (getonbrd.com) — Latin-America tech jobs board. JSON:API format.
// Verified: data[].{ id, attributes:{ title, remote, remote_modality, min_salary,
//   max_salary, description, published_at(unix), remote_zone, countries[] },
//   links:{ public_url } }  — company is only an id reference, so we leave it blank.
import type { NormalizedJob } from './types'
import { stripHtml, salaryRange, unixToIso } from './util'

export async function fetchGetOnBoardJobs(opts: { query?: string; perPage?: number } = {}): Promise<NormalizedJob[]> {
  const query = encodeURIComponent(opts.query || 'developer')
  const perPage = opts.perPage || 30
  const res = await fetch(`https://www.getonbrd.com/api/v0/search/jobs?query=${query}&per_page=${perPage}`, {
    headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`GetOnBoard fetch failed: ${res.status}`)
  const data = await res.json()
  const rows: any[] = Array.isArray(data && data.data) ? data.data : []
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
