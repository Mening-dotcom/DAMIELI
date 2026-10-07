// Small shared helpers for job sources.

export function stripHtml(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Accepts a unix timestamp (seconds or ms) and returns an ISO string, or null.
export function unixToIso(v: unknown): string | null {
  if (v == null || v === '') return null
  const n = Number(v)
  if (isNaN(n) || n <= 0) return null
  const ms = n > 1e12 ? n : n * 1000
  const d = new Date(ms)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function salaryRange(min: unknown, max: unknown, currency = 'USD'): string | null {
  const lo = min ? Number(min) : 0
  const hi = max ? Number(max) : 0
  if (!lo && !hi) return null
  const fmt = (n: number) => n.toLocaleString()
  if (lo && hi) return `${currency} ${fmt(lo)} - ${fmt(hi)}`
  return `${currency} ${fmt(lo || hi)}`
}
