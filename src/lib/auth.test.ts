import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from './auth'

describe('password hashing', () => {
  it('accepts the correct password', () => {
    const hash = hashPassword('secret123')
    expect(verifyPassword('secret123', hash)).toBe(true)
  })

  it('rejects a wrong password', () => {
    const hash = hashPassword('secret123')
    expect(verifyPassword('WRONG', hash)).toBe(false)
  })

  it('produces a different hash for the same password each time (unique salt)', () => {
    expect(hashPassword('secret123')).not.toBe(hashPassword('secret123'))
  })

  it('rejects a malformed hash instead of crashing', () => {
    expect(verifyPassword('secret123', 'not-a-real-hash')).toBe(false)
    // Valid hex but wrong length: timingSafeEqual throws on length mismatch,
    // so verifyPassword must guard it.
    expect(verifyPassword('secret123', 'abcd:1234')).toBe(false)
  })
})

describe('session tokens', () => {
  it('round-trips a user id', () => {
    const token = createSessionToken('user-42')
    expect(verifySessionToken(token)).toBe('user-42')
  })

  it('rejects a tampered signature', () => {
    const token = createSessionToken('user-42')
    const [userId, sig] = token.split('.')
    const flipped = sig[0] === 'a' ? 'b' : 'a'
    expect(verifySessionToken(`${userId}.${flipped}${sig.slice(1)}`)).toBeNull()
  })

  it('rejects a token claiming a different user', () => {
    const token = createSessionToken('user-42')
    const [, sig] = token.split('.')
    expect(verifySessionToken(`user-999.${sig}`)).toBeNull()
  })

  it('rejects garbage tokens', () => {
    expect(verifySessionToken('')).toBeNull()
    expect(verifySessionToken('no-dot-here')).toBeNull()
    expect(verifySessionToken('too.many.dots')).toBeNull()
  })

  it('rejects a wrong-length signature without throwing', () => {
    expect(verifySessionToken('user-42.ff')).toBeNull()
    expect(verifySessionToken('user-42.zz-not-hex')).toBeNull()
  })
})
