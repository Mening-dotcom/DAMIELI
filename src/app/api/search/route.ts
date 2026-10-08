import { NextRequest, NextResponse } from 'next/server'
import { aggregateJobs } from '@/lib/sources'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic' // never cache the route

// GET /api/search?locationType=remote&seniority=Junior
// Pulls from every available source (8 free + any key-gated ones), merges,
// dedupes, and filters. Resilient: a failing source is skipped, not fatal.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const ltRaw = sp.get('locationType')
  const locationType = ltRaw && ltRaw !== 'any' ? ltRaw : undefined
  const seniority = sp.get('seniority') || 'Junior'
  const roles = (sp.get('roles') || '').split(',').map((r) => r.trim()).filter(Boolean)

  try {
    const { jobs, sourceErrors, sources } = await aggregateJobs({ locationType, seniority, roles })
    return NextResponse.json({
      success: true,
      count: jobs.length,
      sources,
      sourceErrors,
      filters: { locationType: locationType || 'any', seniority },
      jobs,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
