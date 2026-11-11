// We Work Remotely — large remote board, free public RSS, free to apply.
// Item shape: <title>Company: Job Title</title>, <region>Anywhere in the World |
// USA Only | Latin America…</region>, <link>, <pubDate>, HTML <description>.
// The region text feeds straight into inferEligibility via `location`.
import type { NormalizedJob } from './types'
import { stripHtml } from './util'

const FEEDS = [
  'https://weworkremotely.com/remote-jobs.rss', // all categories, newest 100
  'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
]

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''
}

function parseFeed(xml: string): NormalizedJob[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
  return items.map((it) => {
    const rawTitle = stripHtml(tag(it, 'title'))
    const sep = rawTitle.indexOf(': ')
    const company = sep > 0 ? rawTitle.slice(0, sep) : 'Unknown'
    const title = sep > 0 ? rawTitle.slice(sep + 2) : rawTitle
    const region = stripHtml(tag(it, 'region')) || 'Remote'
    return {
      source: 'weworkremotely',
      title,
      company,
      description: stripHtml(tag(it, 'description')).slice(0, 4000),
      remoteType: 'remote' as const,
      location: region,
      salaryText: null,
      postedAt: tag(it, 'pubDate') || null,
      url: tag(it, 'link') || 'https://weworkremotely.com',
    }
  }).filter((j) => j.title)
}

export async function fetchWeWorkRemotelyJobs(): Promise<NormalizedJob[]> {
  const results = await Promise.all(FEEDS.map(async (f) => {
    try {
      const res = await fetch(f, { headers: { 'User-Agent': 'DAMIELI personal job-search tool' }, cache: 'no-store' })
      if (!res.ok) return []
      return parseFeed(await res.text())
    } catch {
      return []
    }
  }))
  // The category feed overlaps the all-jobs feed — dedupe by link here.
  const seen = new Set<string>()
  return results.flat().filter((j) => (seen.has(j.url) ? false : (seen.add(j.url), true)))
}
