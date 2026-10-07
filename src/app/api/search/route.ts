import { NextRequest, NextResponse } from 'next/server'
import { fetchMentorhoodJobs, type MentorhoodFilters } from '@/lib/sources/mentorhood'

// Node runtime so we can use fetch + run outside the edge sandbox.
export const runtime = 'nodejs'
// Allow a little time for the upstream fetch.
export const maxDuration = 30

// GET /api/search?locationType=remote&seniority=Junior
// Returns normalized job postings from Mentorhood (Phase 1 — one source).
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const locationType = (sp.get('locationType') as MentorhoodFilters['locationType']) || 'remote'
    const seniority = (sp.get('seniority') as MentorhoodFilters['seniority']) || 'Junior'

    const jobs = await fetchMentorhoodJobs({ locationType, seniority })

    return NextResponse.json({
      success: true,
      count: jobs.length,
      filters: { locationType, seniority },
      jobs,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
