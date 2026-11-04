// First extraction from page.tsx (Phase 2 exercise — the worked example).
// Pure presentational components: data comes in as props, nothing else.

export function ScoreBadge({ score, reason }: { score: number; reason?: string }) {
  const bg = score >= 70 ? '#059669' : score >= 40 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999, color: '#fff', background: bg }}>{score}% match</span>
      {reason ? <span style={{ fontSize: 12, color: '#64748b' }}>{reason}</span> : null}
    </div>
  )
}

type AiEligible = 'yes' | 'no' | 'unclear'

export function EligibilityBadge({ aiEligible, aiEligReason, eligibility }: { aiEligible?: AiEligible | string; aiEligReason?: string; eligibility?: string }) {
  if (aiEligible) {
    const bg = aiEligible === 'yes' ? '#dcfce7' : aiEligible === 'no' ? '#fee2e2' : '#fef3c7'
    const color = aiEligible === 'yes' ? '#15803d' : aiEligible === 'no' ? '#b91c1c' : '#92400e'
    const label = aiEligible === 'yes' ? '✅ Apply from CR' : aiEligible === 'no' ? '⛔ Needs work auth' : '❓ Check eligibility'
    return (
      <span title={aiEligReason || ''} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: bg, color }}>
        {label}{aiEligReason ? ` · ${aiEligReason}` : ''}
      </span>
    )
  }
  if (eligibility && eligibility !== 'unknown') {
    const bg = eligibility === 'us_only' ? '#dbeafe' : eligibility === 'restricted' ? '#fee2e2' : '#dcfce7'
    const color = eligibility === 'us_only' ? '#1d4ed8' : eligibility === 'restricted' ? '#b91c1c' : '#15803d'
    const label = eligibility === 'us_only' ? '🇺🇸 US-based (remote OK)' : eligibility === 'restricted' ? '🚫 Country-restricted' : eligibility === 'latam' ? '🌎 LATAM OK' : '🌍 Worldwide'
    return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: bg, color }}>{label}</span>
  }
  return null
}
