// Arbeitnow — free job-board JSON API (no key). Fields:
// data[].{ title, company_name, description(HTML), remote(bool), location,
//          created_at(unix), url }
import type { NormalizedJob } from './types'
import { stripHtml, unixToIso } from './util'

export async function fetchArbeitnowJobs(): Promise<NormalizedJob[]> {
  const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
    headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Arbeitnow fetch failed: ${res.status}`)
  const data = await res.json()
  const rows: any[] = Array.isArray(data && data.data) ? data.data : []
  return rows.slice(0, 50).map((j: any) => ({
    source: 'arbeitnow',
    title: String(j.title || 'Untitled role'),
    company: String(j.company_name || 'Unknown'),
    description: stripHtml(j.description),
    remoteType: j.remote ? ('remote' as const) : ('onsite' as const),
    location: String(j.location || ''),
    salaryText: null,
    postedAt: unixToIso(j.created_at),
    url: String(j.url || 'https://www.arbeitnow.com'),
  }))
}
