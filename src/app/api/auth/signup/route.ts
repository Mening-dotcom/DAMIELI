import { NextRequest, NextResponse } from 'next/server'
import { createUser, findUserByEmail } from '@/lib/db'
import { hashPassword, setSessionCookie } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { windowMs: 60_000, max: 3 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }

  try {
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

    const normalizedEmail = String(email).trim().toLowerCase()
    const existing = await findUserByEmail(normalizedEmail)
    if (existing) return NextResponse.json({ error: 'User already exists' }, { status: 400 })

    const id = randomUUID()
    const passwordHash = hashPassword(password)
    await createUser({ id, email: normalizedEmail, passwordHash, createdAt: new Date().toISOString() })

    const res = NextResponse.json({ success: true, user: { id, email: normalizedEmail } })
    setSessionCookie(res, id)
    return res
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
