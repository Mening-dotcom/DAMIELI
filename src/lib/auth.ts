import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'damieli_session'
const SECRET = process.env.AUTH_SECRET || 'dev-secret-please-change'
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
  secure: process.env.NODE_ENV === 'production',
}

if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) {
  throw new Error('AUTH_SECRET must be defined in production')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(':')
  if (!salt || !key) return false
  const derived = scryptSync(password, salt, 64)
  return timingSafeEqual(Buffer.from(key, 'hex'), derived)
}

export function createSessionToken(userId: string): string {
  const signature = createHmac('sha256', SECRET).update(userId).digest('hex')
  return `${userId}.${signature}`
}

export function verifySessionToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [userId, signature] = parts
  const expected = createHmac('sha256', SECRET).update(userId).digest('hex')
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) return null
  return userId
}

export function getUserIdFromRequest(req: NextRequest): string | null {
  const cookie = req.cookies.get(COOKIE_NAME)
  if (!cookie) return null
  return verifySessionToken(cookie.value)
}

export function setSessionCookie(res: NextResponse, userId: string) {
  res.cookies.set(COOKIE_NAME, createSessionToken(userId), COOKIE_OPTIONS)
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}
