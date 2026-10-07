// Jobicy — free remote-jobs JSON API (no key). Verified fields:
// jobs[].{ jobTitle, companyName, url, jobGeo, salaryMin/Max/Currency, jobExcerpt, pubDate }
import type { NormalizedJob } from './types'
import { stripHtml, salaryRange } from './util'

export async function fetchJobicyJobs(opts: { count?: number } = {}): Promise<NormalizedJob[]> {
  const count = opts.count || 40
  const res = await fetch(`https://jobicy.com/api/v2/remote-jobs?count=${count}`, {
    headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Jobicy fetch failed: ${res.status}`)
  const data = await res.json()
  const rows: any[] = Array.isArray(data && data.jobs) ? data.jobs : []
  return rows.map((j: any) => ({
    source: 'jobicy',
    title: String(j.jobTitle || 'Untitled role'),
    company: String(j.companyName || 'Unknown'),
    description: stripHtml(j.jobExcerpt || j.jobDescription),
    remoteType: 'remote' as const,
    location: String(j.jobGeo || 'Remote'),
    salaryText: salaryRange(j.salaryMin, j.salaryMax, j.salaryCurrency || 'USD'),
    postedAt: j.pubDate ? String(j.pubDate) : null,
    url: String(j.url || 'https://jobicy.com'),
  }))
}
