import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail } from '@/lib/db'
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

    const user = await findUserByEmail(email.toLowerCase())
    if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    if (!verifyPassword(password, user.passwordHash)) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

    const res = NextResponse.json({ success: true, user: { id: user.id, email: user.email } })
    setSessionCookie(res, user.id)
    return res
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
