// Daily-cap gate for the AI endpoints. Every Claude call costs real money from
// the owner's API key, so each identity gets a daily budget: logged-in users a
// generous one, anonymous visitors (keyed by IP) a small one, and the owner
// account none at all. Backed by bumpUsage (Supabase) — fails open if the
// metering table is missing.
import { NextRequest } from 'next/server'
import { getUserIdFromRequest } from './auth'
import { findUserById, bumpUsage } from './db'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'menabravo.steven@gmail.com').toLowerCase()

export async function checkDailyCap(
  req: NextRequest,
  kind: 'match' | 'generate' | 'roles',
  userLimit: number,
  anonLimit: number,
): Promise<{ allowed: boolean; message?: string }> {
  const userId = getUserIdFromRequest(req)
  if (userId) {
    const user = await findUserById(userId)
    if (user && String(user.email).toLowerCase() === ADMIN_EMAIL) return { allowed: true } // owner: unlimited
    const r = await bumpUsage(userId, kind, userLimit)
    if (r.allowed) return { allowed: true }
    return { allowed: false, message: `Daily ${kind} limit reached (${userLimit}/day) — resets at midnight UTC.` }
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const r = await bumpUsage('ip:' + ip, kind, anonLimit)
  if (r.allowed) return { allowed: true }
  return { allowed: false, message: 'Daily limit reached — sign in for a higher allowance.' }
}
