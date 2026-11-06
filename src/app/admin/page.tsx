'use client'
// Owner-only dashboard. The server decides access (/api/admin/stats returns
// 404 for anyone but the admin account) — this page just renders the answer.
import { useEffect, useState } from 'react'

type AdminUser = { email: string; createdAt: string; cvsOnServer: number; name: string; location: string; jobs: number; skills: number; cvsGenerated: number; jobsAnalyzed: number; timeSaved: number }
type AdminData = { users: AdminUser[]; recentCVs: Array<{ when: string; user: string; role: string; company: string; atsScore: number }>; totals: { users: number; cvsOnServer: number }; generatedAt: string }

const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.12)' }
const td: React.CSSProperties = { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.06)' }
const num: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null)
  const [status, setStatus] = useState<'loading' | 'denied' | 'ok'>('loading')

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) { setStatus('denied'); return }
        const d = await r.json()
        if (d.success) { setData(d); setStatus('ok') } else setStatus('denied')
      })
      .catch(() => setStatus('denied'))
  }, [])

  if (status === 'loading') return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#94a3b8', display: 'grid', placeItems: 'center', fontFamily: 'DM Sans' }}>Loading…</div>
  if (status === 'denied' || !data) return <div style={{ minHeight: '100vh', background: '#0f172a', color: '#94a3b8', display: 'grid', placeItems: 'center', fontFamily: 'DM Sans' }}>Nothing here.</div>

  const weekAgo = Date.now() - 7 * 864e5
  const newThisWeek = data.users.filter((u) => new Date(u.createdAt).getTime() > weekAgo).length
  const active = data.users.filter((u) => u.cvsGenerated > 0 || u.jobsAnalyzed > 0 || u.cvsOnServer > 0).length
  const tiles = [
    { label: 'Total users', value: data.totals.users, note: newThisWeek ? `+${newThisWeek} this week` : 'no new signups this week' },
    { label: 'Active users', value: active, note: 'generated a CV or analyzed jobs' },
    { label: 'CVs on server', value: data.totals.cvsOnServer, note: 'rows in history table' },
    { label: 'Signups last 7 days', value: newThisWeek, note: newThisWeek > 5 ? '⚠ unusual — check emails' : 'normal' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '36px 44px', fontFamily: 'DM Sans, Segoe UI, sans-serif' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, background: 'linear-gradient(90deg,#60a5fa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block', margin: 0 }}>DAMIELI — Owner dashboard</h1>
      <div style={{ color: '#94a3b8', fontSize: 13, margin: '4px 0 24px' }}>Live data · only your account can see this page · generated {new Date(data.generatedAt).toLocaleString()}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 28 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 6 }}>{t.label}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: '#fff' }}>{t.value}</div>
            <div style={{ fontSize: 12, color: '#7dd3fc', marginTop: 6 }}>{t.note}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 15, margin: '26px 0 10px', color: '#cbd5e1' }}>Users ({data.users.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.03)', borderRadius: 12, overflow: 'hidden' }}>
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

      <h2 style={{ fontSize: 15, margin: '26px 0 10px', color: '#cbd5e1' }}>Latest CV generations ({data.recentCVs.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.03)', borderRadius: 12, overflow: 'hidden' }}>
        <thead><tr><th style={th}>When</th><th style={th}>User</th><th style={th}>Role</th><th style={th}>Company</th><th style={{ ...th, textAlign: 'right' }}>ATS</th></tr></thead>
        <tbody>
          {data.recentCVs.length === 0 && <tr><td style={td} colSpan={5}>No CVs generated yet.</td></tr>}
          {data.recentCVs.map((h, i) => (
            <tr key={i}><td style={td}>{h.when}</td><td style={td}>{h.user}</td><td style={td}>{h.role}</td><td style={td}>{h.company}</td><td style={num}>{h.atsScore}%</td></tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 30, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, padding: '18px 22px' }}>
        <h2 style={{ color: '#fca5a5', margin: '0 0 8px', fontSize: 15 }}>🚨 If something looks wrong (attack / abuse checklist)</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
          <li><b>Signup spike or junk emails?</b> Delete the rows in Supabase → Table Editor → users (and their app_state / history rows).</li>
          <li><b>Kick everyone out instantly:</b> rotate AUTH_SECRET in Vercel → Settings → Environment Variables → redeploy. All sessions die; real users just log in again.</li>
          <li><b>Runaway Claude usage:</b> check the Anthropic console; if abused, rotate ANTHROPIC_API_KEY in Vercel.</li>
          <li><b>Nuclear option:</b> Supabase → Settings → Pause project, or Vercel → pause deployment.</li>
          <li><b>Quick links:</b> <a style={{ color: '#7dd3fc' }} href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase</a> · <a style={{ color: '#7dd3fc' }} href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">Vercel</a> · <a style={{ color: '#7dd3fc' }} href="https://console.anthropic.com/settings/usage" target="_blank" rel="noopener noreferrer">Anthropic usage</a></li>
        </ul>
      </div>
    </div>
  )
}
