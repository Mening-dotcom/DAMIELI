// Himalayas — free remote-jobs JSON API (no key). Verified fields:
// jobs[].{ title, companyName, excerpt, description, minSalary/maxSalary/currency,
//          locationRestrictions[], pubDate(unix), applicationLink, guid }
import type { NormalizedJob } from './types'
import { stripHtml, salaryRange, unixToIso } from './util'

export async function fetchHimalayasJobs(opts: { limit?: number } = {}): Promise<NormalizedJob[]> {
  const limit = opts.limit || 40
  const res = await fetch(`https://himalayas.app/jobs/api?limit=${limit}`, {
    headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Himalayas fetch failed: ${res.status}`)
  const data = await res.json()
  const rows: any[] = Array.isArray(data && data.jobs) ? data.jobs : []
  return rows.map((j: any) => {
    const locs: any[] = Array.isArray(j.locationRestrictions) ? j.locationRestrictions.filter(Boolean) : []
    return {
      source: 'himalayas',
      title: String(j.title || 'Untitled role'),
      company: String(j.companyName || 'Unknown'),
      description: stripHtml(j.excerpt || j.description),
      remoteType: 'remote' as const,
      location: locs.length ? locs.join(', ') : 'Worldwide',
      salaryText: salaryRange(j.minSalary, j.maxSalary, j.currency || 'USD'),
      postedAt: unixToIso(j.pubDate),
      url: String(j.applicationLink || j.guid || 'https://himalayas.app'),
    }
  })
}
