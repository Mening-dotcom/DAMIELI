// The Muse — free jobs JSON API (no key). Verified fields:
// results[].{ name, company:{name}, locations:[{name}], refs:{landing_page},
//             contents(HTML), publication_date, levels:[{name}] }
import type { NormalizedJob } from './types'
import { stripHtml } from './util'

export async function fetchTheMuseJobs(opts: { page?: number } = {}): Promise<NormalizedJob[]> {
  const page = opts.page || 1
  const res = await fetch(`https://www.themuse.com/api/public/jobs?page=${page}`, {
    headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`The Muse fetch failed: ${res.status}`)
  const data = await res.json()
  const rows: any[] = Array.isArray(data && data.results) ? data.results : []
  return rows.map((j: any) => {
    const locs: string[] = Array.isArray(j.locations) ? j.locations.map((l: any) => (l && l.name ? String(l.name) : '')).filter(Boolean) : []
    const loc = locs.join(', ')
    const remote = /remote|flexible/i.test(loc)
    return {
      source: 'themuse',
      title: String(j.name || 'Untitled role'),
      company: j.company && j.company.name ? String(j.company.name) : 'Unknown',
      description: stripHtml(j.contents),
      remoteType: remote ? ('remote' as const) : ('onsite' as const),
      location: loc,
      salaryText: null,
      postedAt: j.publication_date ? String(j.publication_date) : null,
      url: j.refs && j.refs.landing_page ? String(j.refs.landing_page) : 'https://www.themuse.com',
    }
  })
}
