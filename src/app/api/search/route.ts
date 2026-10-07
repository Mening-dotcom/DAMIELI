import { NextRequest, NextResponse } from 'next/server'
import { fetchMentorhoodJobs, type MentorhoodFilters } from '@/lib/sources/mentorhood'
import { fetchRemotiveJobs } from '@/lib/sources/remotive'
import type { NormalizedJob } from '@/lib/sources/types'

export const runtime = 'nodejs'
export const maxDuration = 45
export const dynamic = 'force-dynamic' // never cache the route itself

// GET /api/search?locationType=remote&seniority=Junior
// Pulls from every source in parallel and merges the results. A source that
// fails is skipped (its error is reported), the rest still return.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const ltRaw = sp.get('locationType')
  const locationType = (ltRaw && ltRaw !== 'any' ? ltRaw : undefined) as MentorhoodFilters['locationType']
  const seniority = (sp.get('seniority') as MentorhoodFilters['seniority']) || 'Junior'

  const results = await Promise.allSettled([
    fetchMentorhoodJobs({ locationType, seniority }),
    fetchRemotiveJobs({ search: (seniority || 'junior').toLowerCase(), limit: 40 }),
  ])

  const jobs: NormalizedJob[] = []
  const sourceErrors: string[] = []
  const labels = ['mentorhood', 'remotive']
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') jobs.push(...r.value)
    else sourceErrors.push(`${labels[i]}: ${r.reason instanceof Error ? r.reason.message : 'failed'}`)
  })

  // Newest first when we have a date.
  jobs.sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''))

  return NextResponse.json({
    success: true,
    count: jobs.length,
    filters: { locationType, seniority },
    sourceErrors,
    jobs,
  })
}
