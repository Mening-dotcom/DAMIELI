// Mentorhood job source (LATAM board, server-rendered Next.js).
//
// Two bits of data live in the page HTML:
//  1. schema.org JobPosting JSON-LD  → clean structured fields (title, company,
//     description, salary, location, remote type, date).
//  2. the app's flight data          → each job object carries a "link" field
//     with the REAL application URL (computrabajo / icims / inhire / ...).
// We read both and join them so each job has its true apply link.

import type { NormalizedJob, RemoteType } from './types'

export type MentorhoodFilters = {
  locationType?: 'remote' | 'hybrid' | 'onsite'
  seniority?: 'Junior' | 'Mid' | 'Senior' | 'Lead'
}

const BASE = 'https://www.mentorhood.com/en/oportunidades'

function buildUrl(f: MentorhoodFilters): string {
  const p = new URLSearchParams()
  if (f.locationType) p.set('locationType', f.locationType)
  if (f.seniority) p.set('seniority', f.seniority)
  const qs = p.toString()
  return qs ? `${BASE}?${qs}` : BASE
}

function mapRemote(t?: string): RemoteType {
  if (!t) return 'unknown'
  const v = String(t).toUpperCase()
  if (v.includes('TELECOMMUTE')) return 'remote'
  if (v.includes('HYBRID')) return 'hybrid'
  return 'onsite'
}

function orgName(h: unknown): string {
  if (h && typeof h === 'object' && typeof (h as any).name === 'string') return (h as any).name
  return typeof h === 'string' ? h : 'Unknown'
}

function locationText(j: unknown): string {
  if (j && typeof j === 'object') {
    const c = (j as any).address?.addressCountry
    if (typeof c === 'string') return c
  }
  return ''
}

function salaryText(b: unknown): string | null {
  if (b && typeof b === 'object') {
    const cur = typeof (b as any).currency === 'string' ? (b as any).currency : 'USD'
    const val = (b as any).value?.value
    if (typeof val === 'number') return `${cur} ${val.toLocaleString()}`
  }
  return null
}

// --- structured fields from JSON-LD ---
function extractJsonLdJobs(html: string): any[] {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  const jobs: any[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let data: any
    try {
      data = JSON.parse(m[1])
    } catch {
      continue
    }
    const items: any[] = Array.isArray(data && data.itemListElement)
      ? data.itemListElement
      : Array.isArray(data)
        ? data
        : [data]
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const job = it && typeof it === 'object' && 'item' in it ? it.item : it
      if (job && job['@type'] === 'JobPosting') jobs.push(job)
    }
  }
  return jobs
}

// --- apply links from the flight data (each job object has a "link" field) ---
function enclosingObject(s: string, idx: number): string | null {
  let depth = 0
  let start = -1
  for (let i = idx; i >= 0; i--) {
    const c = s[i]
    if (c === '}') depth++
    else if (c === '{') {
      if (depth === 0) { start = i; break }
      depth--
    }
  }
  if (start < 0) return null
  depth = 0
  for (let j = start; j < s.length; j++) {
    const c = s[j]
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return s.slice(start, j + 1) }
  }
  return null
}

function extractApplyLinks(html: string): { byTitle: Map<string, string>; inOrder: string[] } {
  const flat = html.replace(/\\"/g, '"') // flight data escapes quotes as \"
  const byTitle = new Map<string, string>()
  const inOrder: string[] = []
  const re = /"link":"(https?:\/\/[^"]+)"/g
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(flat)) !== null) {
    const link = m[1]
    if (seen.has(link)) continue
    seen.add(link)
    inOrder.push(link)
    const obj = enclosingObject(flat, m.index)
    if (!obj) continue
    try {
      const d = JSON.parse(obj)
      if (d && typeof d.title === 'string') byTitle.set(d.title.trim(), link)
    } catch {
      /* ignore unparseable object */
    }
  }
  return { byTitle, inOrder }
}

export async function fetchMentorhoodJobs(
  filters: MentorhoodFilters = { locationType: 'remote', seniority: 'Junior' },
): Promise<NormalizedJob[]> {
  const url = buildUrl(filters)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
    cache: 'no-store', // always fresh so "Refresh" actually refreshes
  })
  if (!res.ok) throw new Error(`Mentorhood fetch failed: ${res.status}`)
  const html = await res.text()

  const ld = extractJsonLdJobs(html)
  const { byTitle, inOrder } = extractApplyLinks(html)

  return ld.map((j, i) => {
    const title = typeof j.title === 'string' ? j.title : 'Untitled role'
    const applyUrl = byTitle.get(title.trim()) || inOrder[i] || url
    return {
      source: 'mentorhood',
      title,
      company: orgName(j.hiringOrganization),
      description: typeof j.description === 'string' ? j.description : '',
      remoteType: mapRemote(j.jobLocationType),
      location: locationText(j.jobLocation),
      salaryText: salaryText(j.baseSalary),
      postedAt: typeof j.datePosted === 'string' ? j.datePosted : null,
      url: applyUrl,
    }
  })
}
