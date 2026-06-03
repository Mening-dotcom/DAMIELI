import { NextRequest } from 'next/server'

interface RateLimitEntry {
  tokens: number
  lastRefill: number
}

interface RateLimitOptions {
  windowMs: number
  max: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

declare global {
  var __CVBUILDER_RATE_LIMITER__: Map<string, RateLimitEntry> | undefined
}

const limiter = globalThis.__CVBUILDER_RATE_LIMITER__ ||= new Map<string, RateLimitEntry>()

function getClientKey(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  const anyReq = req as any
  if (typeof anyReq.ip === 'string' && anyReq.ip) return anyReq.ip
  return `unknown:${req.headers.get('user-agent')?.slice(0, 64) ?? 'no-agent'}`
}

export function rateLimit(req: NextRequest, options: RateLimitOptions): RateLimitResult {
  const key = getClientKey(req)
  const now = Date.now()
  const ratePerMs = options.max / options.windowMs
  const entry = limiter.get(key) || { tokens: options.max, lastRefill: now }

  const elapsed = now - entry.lastRefill
  if (elapsed > 0) {
    entry.tokens = Math.min(options.max, entry.tokens + elapsed * ratePerMs)
    entry.lastRefill = now
  }

  if (entry.tokens < 1) {
    const needed = 1 - entry.tokens
    const retryAfter = Math.ceil(needed / ratePerMs / 1000)
    const resetAt = now + Math.ceil(needed / ratePerMs)
    limiter.set(key, entry)
    return { allowed: false, remaining: 0, resetAt, retryAfter }
  }

  entry.tokens -= 1
  limiter.set(key, entry)
  return {
    allowed: true,
    remaining: Math.floor(entry.tokens),
    resetAt: now + Math.ceil((1 - entry.tokens) / ratePerMs),
  }
}
