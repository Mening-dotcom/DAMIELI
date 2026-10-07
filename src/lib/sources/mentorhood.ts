// Mentorhood job source.
//
// Mentorhood (a LATAM job board) is a server-rendered Next.js site that embeds
// its listings as schema.org JobPosting data inside a
// <script type="application/ld+json"> block. We fetch the page HTML and read
// that structured JSON — no headless browser, no fragile HTML scraping.
//
// This same JSON-LD approach works on many other job boards, so this file is a
// template for adding more sources later.

export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'

export type NormalizedJob = {
  source: string
  title: string
  company: string
  description: string
  remoteType: RemoteType
  location: string
  salary: { currency: string; value: number } | null
  postedAt: string | null
  url: string // link back to the board (per-job apply URLs come later)
}

export type MentorhoodFilters = {
  locationType?: 'remote' | 'hybrid' | 'onsite'
  seniority?: 'Junior' | 'Mid' | 'Senior' | 'Lead'
}

const BASE = 'https://www.mentorhood.com/en/oportunidades'

function buildUrl(filters: MentorhoodFilters): string {
  const params = new URLSearchParams()
  if (filters.locationType) params.set('locationType', filters.locationType)
  if (filters.seniority) params.set('seniority', filters.seniority)
  const qs = params.toString()
  return qs ? `${BASE}?${qs}` : BASE
}

function mapLocationType(jobLocationType?: string): RemoteType {
  if (!jobLocationType) return 'unknown'
  const v = String(jobLocationType).toUpperCase()
  if (v.includes('TELECOMMUTE')) return 'remote'
  if (v.includes('HYBRID')) return 'hybrid'
  return 'onsite'
}

function orgName(hiringOrganization: unknown): string {
  if (hiringOrganization && typeof hiringOrganization === 'object') {
    const name = (hiringOrganization as { name?: unknown }).name
    if (typeof name === 'string') return name
  }
  return typeof hiringOrganization === 'string' ? hiringOrganization : 'Unknown'
}

function locationText(jobLocation: unknown): string {
  if (jobLocation && typeof jobLocation === 'object') {
    const addr = (jobLocation as { address?: { addressCountry?: unknown } }).address
    const country = addr?.addressCountry
    if (typeof country === 'string') return country
  }
  return ''
}

function salaryOf(baseSalary: unknown): NormalizedJob['salary'] {
  if (baseSalary && typeof baseSalary === 'object') {
    const b = baseSalary as { currency?: unknown; value?: { value?: unknown } }
    const currency = typeof b.currency === 'string' ? b.currency : 'USD'
    const value = b.value?.value
    if (typeof value === 'number') return { currency, value }
  }
  return null
}

// Pull every JSON-LD block out of the HTML and collect JobPosting entries.
// Uses a regex exec loop + index loop (no iterator spread / for-of) so it
// compiles regardless of the project's TypeScript target.
function extractJobPostings(html: string): any[] {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  const jobs: any[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    let data: any
    try {
      data = JSON.parse(match[1])
    } catch {
      continue // skip malformed blocks rather than crash the whole fetch
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

export async function fetchMentorhoodJobs(
  filters: MentorhoodFilters = { locationType: 'remote', seniority: 'Junior' },
): Promise<NormalizedJob[]> {
  const url = buildUrl(filters)
  const res = await fetch(url, {
    headers: { 'User-Agent': 'DAMIELI personal job-search tool' },
    // Cache for an hour so we're polite to the board and fast to the user.
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Mentorhood fetch failed: ${res.status}`)
  const html = await res.text()

  return extractJobPostings(html).map((j) => ({
    source: 'mentorhood',
    title: typeof j.title === 'string' ? j.title : 'Untitled role',
    company: orgName(j.hiringOrganization),
    description: typeof j.description === 'string' ? j.description : '',
    remoteType: mapLocationType(j.jobLocationType),
    location: locationText(j.jobLocation),
    salary: salaryOf(j.baseSalary),
    postedAt: typeof j.datePosted === 'string' ? j.datePosted : null,
    url,
  }))
}
