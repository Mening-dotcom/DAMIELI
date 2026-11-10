// English → Spanish job-title synonyms. LATAM boards (GetOnBoard, Computrabajo)
// list jobs in Spanish, so both the server-side source queries AND the
// client-side keyword filter must understand the Spanish names — otherwise the
// app searches for "IT support" and never sees "Soporte Técnico".
export const ES_SYNONYMS: Record<string, string[]> = {
  'it support': ['soporte ti', 'soporte técnico'],
  'technical support': ['soporte técnico'],
  'tech support': ['soporte técnico'],
  'help desk': ['mesa de ayuda'],
  'customer support': ['atención al cliente'],
  'customer service': ['servicio al cliente'],
  'developer': ['desarrollador'],
  'software engineer': ['desarrollador'],
  'qa tester': ['qa'],
  'interpreter': ['intérprete'],
  'translator': ['traductor'],
  'medical biller': ['facturación'],
  'collections specialist': ['cobros'],
  'credit analyst': ['crédito'],
  'accounts receivable': ['cuentas por cobrar'],
  'data entry': ['digitador'],
  'virtual assistant': ['asistente virtual'],
}

// Spanish equivalents for a list of role terms (deduped, order-stable).
export function spanishSynonyms(terms: string[]): string[] {
  return Array.from(new Set(terms.flatMap((t) => ES_SYNONYMS[t.toLowerCase().trim()] || [])))
}
