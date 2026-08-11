import { NextRequest, NextResponse } from 'next/server'
import { findUsersByEmail } from '@/lib/db'
import { verifyPassword, setSessionCookie } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { windowMs: 60_000, max: 5 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }

  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

    const normalizedEmail = String(email).trim().toLowerCase()
    const users = await findUsersByEmail(normalizedEmail)
    if (!users.length) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const matchedUser = users.find(u => verifyPassword(password, u.passwordHash))
    if (!matchedUser) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const res = NextResponse.json({ success: true, user: { id: matchedUser.id, email: matchedUser.email } })
    setSessionCookie(res, matchedUser.id)
    return res
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
