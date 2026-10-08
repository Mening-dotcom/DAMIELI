// Small shared helpers for job sources.
import type { Eligibility } from './types'

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

const LATAM_HINTS = /latam|latin america|south america|central america|the americas|costa rica|m[eé]xico|mexico|brazil|brasil|colombia|argentina|chile|per[uú]|peru|ecuador|guatemala|uruguay|bolivia|paraguay|venezuela|dominican|honduras|nicaragua|el salvador/i
const WORLDWIDE_HINTS = /worldwide|anywhere in the world|work from anywhere|globally|global remote|any country|any time ?zone|international|no visa|hire (globally|anywhere)|open to all countries|location[- ]independent/i
const US_ONLY_HINTS = /\bu\.?s\.?\s*(only|based|residents?|citizens?)\b|united states only|only.{0,15}united states|must (be|reside|live|located).{0,25}(united states|u\.?s\.?a?\b)|(based|located|reside) (in|within) the (united states|u\.?s\.?a?\b|us)|authoriz(ed|ation).{0,25}(united states|u\.?s\.?a?\b)|usa[- ]only|us[- ]only|eligible to work in the (us|united states)|no visa sponsorship|visa sponsorship (is )?not|green card/i

// Best-effort guess at whether a LATAM-based applicant (e.g. Costa Rica) can apply.
export function inferEligibility(location: string, description: string, source: string): Eligibility {
  if (source === 'mentorhood' || source === 'getonbrd') return 'latam'
  const loc = String(location || '').toLowerCase().trim()
  const text = (loc + ' ' + String(description || '')).toLowerCase()
  if (LATAM_HINTS.test(text)) return 'latam'
  if (WORLDWIDE_HINTS.test(text)) return 'worldwide'
  if (US_ONLY_HINTS.test(text)) return 'us_only'
  if (/^(usa|u\.?s\.?a?|united states)$/.test(loc)) return 'us_only'
  return 'unknown'
}

export function salaryRange(min: unknown, max: unknown, currency = 'USD'): string | null {
  const lo = min ? Number(min) : 0
  const hi = max ? Number(max) : 0
  if (!lo && !hi) return null
  const fmt = (n: number) => n.toLocaleString()
  if (lo && hi) return `${currency} ${fmt(lo)} - ${fmt(hi)}`
  return `${currency} ${fmt(lo || hi)}`
}
