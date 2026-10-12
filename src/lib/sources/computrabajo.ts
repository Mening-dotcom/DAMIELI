// Computrabajo Costa Rica — the biggest local CR job board. Server-rendered
// HTML (no API), so we read the search pages directly. Local CR jobs are
// applyable for someone living in Costa Rica, so these are tagged LATAM.
import type { NormalizedJob, RemoteType } from './types'
import { stripHtml } from './util'

const BASE = 'https://cr.computrabajo.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

function slugify(q: string): string {
  return q
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return ' ' } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(Number(d)) } catch { return ' ' } })
}
function clean(s: string): string {
  return stripHtml(decodeEntities(s)).replace(/\s+/g, ' ').trim()
}

function parse(htmlDoc: string): NormalizedJob[] {
  const out: NormalizedJob[] = []
  const re = /<article class="box_offer[\s\S]*?<\/article>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(htmlDoc)) !== null) {
    const block = m[0]
    const hrefM = block.match(/href="(\/ofertas-de-trabajo\/[^"#]+)/)
    if (!hrefM) continue
    const url = BASE + hrefM[1]
    const titleM = block.match(/<a class="js-o-link[^"]*"[^>]*>([\s\S]*?)<\/a>/)
    const title = titleM ? clean(titleM[1]) : ''
    if (!title) continue
    const compM = block.match(/offer-grid-article-company-url[^>]*>\s*([^<]+)/)
    const company = compM ? clean(compM[1]) : 'See listing'
    const locM = block.match(/<p class="fs16 fc_base mt5">\s*<span[^>]*>\s*([^<]+)/)
    const location = locM ? clean(locM[1]) : 'Costa Rica'
    const salM = block.match(/i_salary[\s\S]*?<\/span>\s*([^<]+)/)
    const salaryText = salM ? clean(salM[1]) || null : null
    const postM = block.match(/<p class="fs13 fc_aux[^"]*">\s*([^<]+)/)
    const postedAt = postM ? clean(postM[1]) : null
    const hay = (title + ' ' + location).toLowerCase()
    const remoteType: RemoteType = /remoto|teletrabajo|home ?office|remote/.test(hay) ? 'remote' : /h[ií]brido|hybrid/.test(hay) ? 'hybrid' : 'onsite'
    out.push({
      source: 'computrabajo',
      title,
      company,
      description: `${title} — ${company}. ${location}.${salaryText ? ' ' + salaryText + '.' : ''} (Costa Rica local listing)`,
      remoteType,
      location,
      salaryText,
      postedAt,
      url,
    })
  }
  return out
}

async function fetchPage(slug: string, page: number): Promise<NormalizedJob[]> {
  const url = `${BASE}/trabajo-de-${slug}${page > 1 ? `?p=${page}` : ''}`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
    if (!res.ok) return []
    return parse(await res.text())
  } catch {
    return []
  }
}

export async function fetchComputrabajoJobs(opts: { query?: string; pages?: number } = {}): Promise<NormalizedJob[]> {
  const slug = slugify(opts.query || 'desarrollador') || 'desarrollador'
  const pages = Math.min(Math.max(opts.pages || 1, 1), 3)
  const nums: number[] = []
  for (let p = 1; p <= pages; p++) nums.push(p)
  const results = await Promise.all(nums.map((p) => fetchPage(slug, p)))
  return results.reduce((acc: NormalizedJob[], r: NormalizedJob[]) => acc.concat(r), [])
}

export { parse as _parseComputrabajo }
