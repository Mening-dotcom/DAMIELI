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

// Countries/regions a Costa-Rica resident canNOT legally work from. If a job is
// restricted to one of these — even without the word "visa" — it's not applyable.
const OTHER_COUNTRIES = '(uk|u\\.k\\.|united kingdom|england|eu\\b|european union|europe|emea|canada|australia|new zealand|germany|france|spain|portugal|netherlands|poland|ireland|india|philippines|japan|singapore|israel|switzerland|austria|belgium|sweden|norway|denmark|finland)'
const RESTRICTED_HINTS = new RegExp(
  `${OTHER_COUNTRIES}[- ](only|based (candidates|applicants|employees)|residents? only)` +
  `|only (open to|available (to|in)|hiring (in|from)).{0,20}${OTHER_COUNTRIES}` +
  `|must (be|reside|live|be located|be based).{0,25}${OTHER_COUNTRIES}` +
  `|(right|authoriz(ed|ation)|eligib(le|ility)|permit) to work (in|within) (the )?${OTHER_COUNTRIES}` +
  `|remote.{0,12}\\(?${OTHER_COUNTRIES}( only)?\\)?$`,
  'i',
)
// Location fields that ARE just a restricted country/region ("Remote (UK)", "Germany").
const RESTRICTED_LOC = new RegExp(`^(remote[,( -]*)?${OTHER_COUNTRIES}[) ]*(only)?$`, 'i')

// Best-effort guess at whether a LATAM-based applicant (e.g. Costa Rica) can apply.
export function inferEligibility(location: string, description: string, source: string): Eligibility {
  if (source === 'mentorhood' || source === 'getonbrd' || source === 'computrabajo') return 'latam'
  const loc = String(location || '').toLowerCase().trim()
  const text = (loc + ' ' + String(description || '')).toLowerCase()
  if (LATAM_HINTS.test(text)) return 'latam'
  if (WORLDWIDE_HINTS.test(text)) return 'worldwide'
  if (US_ONLY_HINTS.test(text)) return 'us_only'
  if (/^(usa|u\.?s\.?a?|united states)$/.test(loc)) return 'us_only'
  if (RESTRICTED_LOC.test(loc) || RESTRICTED_HINTS.test(text)) return 'restricted'
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
