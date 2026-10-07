// RemoteOK job source — free public JSON (no key). First array element is a
// legal/metadata notice (no `position`), so we skip it. Each job has a real
// apply URL.
import type { NormalizedJob } from './types'

function stripHtml(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function fetchRemoteOkJobs(): Promise<NormalizedJob[]> {
  const res = await fetch('https://remoteok.com/api', {
    headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`)
  const data = await res.json()
  const rows: any[] = Array.isArray(data) ? data.filter((r: any) => r && r.position && r.id) : []

  return rows.slice(0, 50).map((j: any) => {
    const min = j.salary_min ? '$' + Number(j.salary_min).toLocaleString() : ''
    const max = j.salary_max ? ' - $' + Number(j.salary_max).toLocaleString() : ''
    const salaryText = (min + max).trim() || null
    return {
      source: 'remoteok',
      title: String(j.position || 'Untitled role'),
      company: String(j.company || 'Unknown'),
      description: stripHtml(j.description),
      remoteType: 'remote' as const,
      location: String(j.location || 'Remote'),
      salaryText,
      postedAt: j.date ? String(j.date) : null,
      url: String(j.url || (j.slug ? `https://remoteok.com/remote-jobs/${j.slug}` : 'https://remoteok.com')),
    }
  })
}
