// The Muse — free jobs JSON API (no key). Paginated; we pull several pages in
// parallel for real volume.
// results[].{ name, company:{name}, locations:[{name}], refs:{landing_page},
//             contents(HTML), publication_date }
import type { NormalizedJob } from './types'
import { stripHtml } from './util'

async function fetchPage(page: number): Promise<any[]> {
  try {
    const res = await fetch(`https://www.themuse.com/api/public/jobs?page=${page}`, {
      headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data && data.results) ? data.results : []
  } catch {
    return []
  }
}

export async function fetchTheMuseJobs(opts: { pages?: number } = {}): Promise<NormalizedJob[]> {
  const pages = Math.min(Math.max(opts.pages || 3, 1), 6)
  const nums: number[] = []
  for (let p = 1; p <= pages; p++) nums.push(p)
  const results = await Promise.all(nums.map(fetchPage))
  const rows = results.reduce((acc: any[], r: any[]) => acc.concat(r), [])
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
