import { NextResponse } from 'next/server'
import { pingDb } from '@/lib/db'

// Hit daily by the Vercel Cron in vercel.json so the free-tier Supabase
// project always sees activity and never auto-pauses.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ok = await pingDb()
    return NextResponse.json({ ok, db: ok ? 'up' : 'error' }, { status: ok ? 200 : 500 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
