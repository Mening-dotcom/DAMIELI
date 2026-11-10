// Job-title FAMILIES — the same job hides behind many titles ("help desk" =
// "service desk" = "desktop support" = "soporte técnico"). The user types ONE
// seed term (or auto-pick does); the aggregator searches the whole family,
// English AND Spanish, so no job escapes over vocabulary. Final relevance is
// decided semantically by Smart match, not by keywords.

const FAMILIES: string[][] = [
  ['technical support', 'it support', 'tech support', 'help desk', 'service desk', 'desktop support', 'support engineer', 'soporte técnico', 'soporte ti', 'mesa de ayuda'],
  ['customer support', 'customer service', 'customer success', 'customer care', 'client support', 'support agent', 'atención al cliente', 'servicio al cliente'],
  ['interpreter', 'medical interpreter', 'translator', 'bilingual', 'localization', 'intérprete', 'traductor'],
  ['medical biller', 'medical billing', 'billing specialist', 'medical records', 'facturación'],
  ['collections specialist', 'collections', 'accounts receivable', 'debt recovery', 'cobros', 'cuentas por cobrar'],
  ['credit analyst', 'credit risk', 'risk analyst', 'crédito'],
  ['qa tester', 'quality assurance', 'qa analyst', 'software tester', 'qa'],
  ['developer', 'software engineer', 'web developer', 'frontend', 'backend', 'desarrollador', 'programador'],
  ['data entry', 'data analyst', 'digitador'],
  ['virtual assistant', 'administrative assistant', 'back office', 'asistente virtual'],
  ['sales development', 'sdr', 'appointment setter', 'ventas'],
]

// term → its whole family (first lookup wins; unknown terms stay as-is)
const FAMILY_OF = new Map<string, string[]>()
for (const fam of FAMILIES) for (const t of fam) if (!FAMILY_OF.has(t)) FAMILY_OF.set(t, fam)

// Expand the user's seed terms into every known title variant (EN + ES),
// deduped, seeds first, capped so the fan-out stays sane.
export function expandRoleTerms(terms: string[], cap = 18): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (t: string) => { const k = t.toLowerCase().trim(); if (k && !seen.has(k)) { seen.add(k); out.push(k) } }
  for (const t of terms) push(t) // user's own words always searched first
  for (const t of terms) for (const v of FAMILY_OF.get(t.toLowerCase().trim()) || []) push(v)
  return out.slice(0, cap)
}
