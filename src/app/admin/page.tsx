'use client'
// Owner-only dashboard, styled with the app's own design tokens (globals.css).
// The server decides access — /api/admin/stats returns 404 for anyone but the
// admin account; this page just renders the answer.
import { useEffect, useState } from 'react'

type AdminUser = { email: string; createdAt: string; cvsOnServer: number; name: string; location: string; jobs: number; skills: number; cvsGenerated: number; jobsAnalyzed: number; timeSaved: number }
type AdminData = { users: AdminUser[]; recentCVs: Array<{ when: string; user: string; role: string; company: string; atsScore: number }>; totals: { users: number; cvsOnServer: number }; generatedAt: string }

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: '0 10px 30px rgba(6, 58, 75, 0.08)' }
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', padding: '12px 14px', borderBottom: '1px solid var(--border)', fontFamily: 'Syne', fontWeight: 700 }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, borderBottom: '1px solid var(--border)', color: 'var(--ink)' }
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null)
  const [status, setStatus] = useState<'loading' | 'denied' | 'ok'>('loading')

  useEffect(() => {
    fetch('/api/admin/stats' + window.location.search, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) { setStatus('denied'); return }
        const d = await r.json()
        if (d.success) { setData(d); setStatus('ok') } else setStatus('denied')
      })
      .catch(() => setStatus('denied'))
  }, [])

  if (status === 'loading') return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>Loading…</div>
  if (status === 'denied' || !data) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>Nothing here.</div>

  const weekAgo = Date.now() - 7 * 864e5
  const newThisWeek = data.users.filter((u) => new Date(u.createdAt).getTime() > weekAgo).length
  const active = data.users.filter((u) => u.cvsGenerated > 0 || u.jobsAnalyzed > 0 || u.cvsOnServer > 0).length
  const tiles = [
    { label: 'Total users', value: data.totals.users, note: newThisWeek ? `+${newThisWeek} this week` : 'no new signups this week', color: '#4f46e5' },
    { label: 'Active users', value: active, note: 'generated a CV or analyzed jobs', color: '#ec4899' },
    { label: 'CVs on server', value: data.totals.cvsOnServer, note: 'rows in history table', color: '#7c3aed' },
    { label: 'Signups last 7 days', value: newThisWeek, note: newThisWeek > 5 ? '⚠ unusual — check emails' : 'normal', color: newThisWeek > 5 ? '#ef4444' : '#22c55e' },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 48px' }}>
      {/* Brand header band — same gradient as the app sidebar */}
      <div style={{ background: 'linear-gradient(165deg, #1e3a8a 0%, #4f46e5 50%, #be185d 120%)', padding: '26px 44px 24px' }}>
        <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>DAMIELI <span style={{ fontWeight: 700, color: '#c4ccf8' }}>· Owner dashboard</span></div>
        <div style={{ color: '#c4ccf8', fontSize: 12, marginTop: 4 }}>Live data · only your account can see this page · generated {new Date(data.generatedAt).toLocaleString()}</div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 26 }}>
          {tiles.map((t) => (
            <div key={t.label} style={{ ...card, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, fontFamily: 'Syne', fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontFamily: 'Syne', fontSize: 34, fontWeight: 800, color: t.color }}>{t.value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{t.note}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 16, margin: '24px 0 10px', color: '#0b3d91' }}>Users ({data.users.length})</h2>
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <th style={th}>Email</th><th style={th}>Name</th><th style={th}>Location</th>
              <th style={{ ...th, textAlign: 'right' }}>Jobs in profile</th><th style={{ ...th, textAlign: 'right' }}>Skills</th>
              <th style={{ ...th, textAlign: 'right' }}>CVs (stats)</th><th style={{ ...th, textAlign: 'right' }}>Jobs analyzed</th>
              <th style={{ ...th, textAlign: 'right' }}>CVs on server</th><th style={th}>Signed up</th>
            </tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.email}>
                  <td style={{ ...td, fontWeight: 700 }}>{u.email}</td>
                  <td style={td}>{u.name || '—'}</td>
                  <td style={td}>{u.location || '—'}</td>
                  <td style={num}>{u.jobs}</td>
                  <td style={num}>{u.skills}</td>
                  <td style={num}>{u.cvsGenerated}</td>
                  <td style={num}>{u.jobsAnalyzed}</td>
                  <td style={num}>{u.cvsOnServer}</td>
                  <td style={td}>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={{ fontSize: 16, margin: '24px 0 10px', color: '#0b3d91' }}>Latest CV generations ({data.recentCVs.length})</h2>
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>When</th><th style={th}>User</th><th style={th}>Role</th><th style={th}>Company</th><th style={{ ...th, textAlign: 'right' }}>ATS</th></tr></thead>
            <tbody>
              {data.recentCVs.length === 0 && <tr><td style={td} colSpan={5}>No CVs generated yet.</td></tr>}
              {data.recentCVs.map((h, i) => (
                <tr key={i}><td style={td}>{h.when}</td><td style={td}>{h.user}</td><td style={td}>{h.role}</td><td style={td}>{h.company}</td><td style={{ ...num, color: h.atsScore >= 80 ? '#15803d' : '#b45309', fontWeight: 700 }}>{h.atsScore}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 26, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: '18px 22px' }}>
          <h2 style={{ color: '#b91c1c', margin: '0 0 8px', fontSize: 15 }}>🚨 If something looks wrong (attack / abuse checklist)</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: '#7f1d1d' }}>
            <li><b>Signup spike or junk emails?</b> Delete the rows in Supabase → Table Editor → users (and their app_state / history rows).</li>
            <li><b>Kick everyone out instantly:</b> rotate AUTH_SECRET in Vercel → Settings → Environment Variables → redeploy. All sessions die; real users just log in again.</li>
            <li><b>Runaway Claude usage:</b> check the Anthropic console; if abused, rotate ANTHROPIC_API_KEY in Vercel.</li>
            <li><b>Nuclear option:</b> Supabase → Settings → Pause project, or Vercel → pause deployment.</li>
            <li><b>Quick links:</b> <a style={{ color: '#4f46e5' }} href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase</a> · <a style={{ color: '#4f46e5' }} href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">Vercel</a> · <a style={{ color: '#4f46e5' }} href="https://console.anthropic.com/settings/usage" target="_blank" rel="noopener noreferrer">Anthropic usage</a></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
