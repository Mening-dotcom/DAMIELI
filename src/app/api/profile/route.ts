import { NextRequest, NextResponse } from 'next/server'
import { getAppState, saveAppState } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const state = await getAppState(userId)
    return NextResponse.json({ success: true, state })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const state = body?.state || body
    const { profile, stats, history, templateId, outputLanguage } = state || {}
    if (!profile || stats === undefined) {
      return NextResponse.json({ error: 'Missing profile or stats' }, { status: 400 })
    }
    await saveAppState(userId, { profile, stats, history, templateId, outputLanguage })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
