import { NextRequest, NextResponse } from 'next/server'
import { pingDb, prunePoolJobs } from '@/lib/db'
import { aggregateJobs } from '@/lib/sources'

// Hit daily by the Vercel Cron in vercel.json so the free-tier Supabase
// project always sees activity and never auto-pauses.
// With ?harvest=1 it also runs a broad job fetch: aggregateJobs persists every
// live job into the accumulating pool, then stale rows (>30 days unseen) are
// pruned — the pool grows daily even if no user refreshes.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HARVEST_ROLES = ['customer support', 'technical support', 'interpreter', 'medical biller', 'collections specialist', 'qa tester', 'developer', 'virtual assistant', 'data entry', 'sales development']

export async function GET(req: NextRequest) {
  try {
    const ok = await pingDb()
    let harvested: number | undefined
    if (req.nextUrl.searchParams.get('harvest') === '1') {
      const { jobs } = await aggregateJobs({ locationType: 'remote', seniority: 'Junior', roles: HARVEST_ROLES })
      harvested = jobs.length
      await prunePoolJobs(30)
    }
    return NextResponse.json({ ok, db: ok ? 'up' : 'error', ...(harvested !== undefined ? { harvested } : {}) }, { status: ok ? 200 : 500 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
