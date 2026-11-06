import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/auth'
import { findUserById, adminListUsers, adminListStates, adminListHistory } from '@/lib/db'

export const runtime = 'nodejs'

// Owner-only stats. Anyone who is not the admin gets a plain 404 — the
// endpoint should look like it doesn't exist at all.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'menabravo.steven@gmail.com').toLowerCase()

export async function GET(req: NextRequest) {
  const userId = getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const user = await findUserById(userId)
  if (!user || String(user.email).toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [users, states, history] = await Promise.all([adminListUsers(), adminListStates(), adminListHistory()])

  // The app_state.profile column holds the whole state blob ({profile, stats, ...})
  // for newer rows, or just the profile for the oldest ones — same contract as
  // getAppState in lib/db.
  const byUser = new Map<string, { name: string; location: string; jobs: number; skills: number; cvsGenerated: number; jobsAnalyzed: number; timeSaved: number }>()
  for (const s of states) {
    const raw = s.profile as Record<string, unknown> | null
    const blob = raw && typeof raw === 'object' && 'profile' in raw ? (raw as { profile: Record<string, unknown>; stats?: Record<string, unknown> }) : { profile: raw || {}, stats: (s.stats as Record<string, unknown>) || {} }
    const p = (blob.profile || {}) as Record<string, unknown>
    const st = (blob.stats || {}) as Record<string, unknown>
    byUser.set(s.userId, {
      name: typeof p.name === 'string' ? p.name : '',
      location: typeof p.location === 'string' ? p.location : '',
      jobs: Array.isArray(p.jobs) ? p.jobs.length : 0,
      skills: Array.isArray(p.skills) ? p.skills.length : 0,
      cvsGenerated: Number(st.cvsGenerated) || 0,
      jobsAnalyzed: Number(st.jobsAnalyzed) || 0,
      timeSaved: Number(st.totalTimeSaved) || 0,
    })
  }

  const cvCount = new Map<string, number>()
  for (const h of history) cvCount.set(h.userId, (cvCount.get(h.userId) || 0) + 1)
  const emailById = new Map(users.map((u) => [u.id, u.email]))

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    users: users.map((u) => ({
      email: u.email,
      createdAt: u.createdAt,
      cvsOnServer: cvCount.get(u.id) || 0,
      ...(byUser.get(u.id) || { name: '', location: '', jobs: 0, skills: 0, cvsGenerated: 0, jobsAnalyzed: 0, timeSaved: 0 }),
    })),
    recentCVs: history.slice(0, 15).map((h) => ({
      when: h.generatedAt, user: emailById.get(h.userId) || h.userId, role: h.role, company: h.company, atsScore: h.atsScore,
    })),
    totals: { users: users.length, cvsOnServer: history.length },
  })
}
