// Remotive job source — a free public JSON API of remote jobs (no key needed).
// Every job includes a real detail/apply URL, so apply links are clean here.
// https://remotive.com/api/remote-jobs

import type { NormalizedJob } from './types'

export type RemotiveFilters = {
  search?: string // keyword, e.g. "junior developer"
  limit?: number
}

function stripHtml(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s
    .replace(/<[^>]+>/g, ' ') // drop tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchRemotiveJobs(
  filters: RemotiveFilters = {},
): Promise<NormalizedJob[]> {
  const p = new URLSearchParams()
  if (filters.search) p.set('search', filters.search)
  if (filters.limit) p.set('limit', String(filters.limit))
  const url = `https://remotive.com/api/remote-jobs${p.toString() ? `?${p}` : ''}`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Remotive fetch failed: ${res.status}`)
  const data = await res.json()
  const jobs: any[] = Array.isArray(data && data.jobs) ? data.jobs : []

  return jobs.map((j) => ({
    source: 'remotive',
    title: typeof j.title === 'string' ? j.title : 'Untitled role',
    company: typeof j.company_name === 'string' ? j.company_name : 'Unknown',
    description: stripHtml(j.description),
    remoteType: 'remote' as const,
    location: typeof j.candidate_required_location === 'string' ? j.candidate_required_location : 'Remote',
    salaryText: typeof j.salary === 'string' && j.salary.trim() ? j.salary.trim() : null,
    postedAt: typeof j.publication_date === 'string' ? j.publication_date : null,
    url: typeof j.url === 'string' ? j.url : 'https://remotive.com',
  }))
}
