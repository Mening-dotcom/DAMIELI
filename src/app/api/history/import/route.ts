import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromRequest } from '@/lib/auth'
import { saveGeneratedCV } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { windowMs: 60_000, max: 1000 }) 
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }

  try {
    const userId = getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await req.json()
    const items = Array.isArray(payload.history) ? payload.history : (payload.item ? [payload.item] : [])
    if (!items.length) return NextResponse.json({ error: 'No history items provided' }, { status: 400 })

    for (const it of items) {
      // Basic validation / normalization
      const record = {
        id: it.id || (Math.random().toString(36).slice(2, 10)),
        role: it.role || 'Role',
        company: it.company || 'Company',
        jobUrl: it.jobUrl || '',
        generatedAt: it.generatedAt || new Date().toISOString(),
        atsScore: it.atsScore || 0,
        matchedKeywords: it.matchedKeywords || [],
        timeSavedMinutes: it.timeSavedMinutes || 0,
        cvData: it.cvData || {},
      }
      try {
        // saveGeneratedCV expects the cv record and userId
        // it will stringify fields appropriately for storage
        // eslint-disable-next-line no-await-in-loop
        await saveGeneratedCV(record, userId)
      } catch (e) {
        console.error('Failed to save history item', e)
      }
    }

    return NextResponse.json({ success: true, imported: items.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
