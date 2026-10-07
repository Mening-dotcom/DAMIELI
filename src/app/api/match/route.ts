import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/match  { profileText, jobs: [{title, company, description}] }
// Semantic fit scoring in ONE batched Claude call. Scores by TRANSFERABLE fit,
// not keyword overlap — the whole point is that fit is deeper than exact words.
export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { windowMs: 60_000, max: 8 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }
  try {
    const { profileText, jobs } = await req.json()
    if (!profileText || !Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: 'Missing profile or jobs' }, { status: 400 })
    }

    const list = jobs.slice(0, 30).map((j: any, i: number) =>
      `#${i}\nTitle: ${String(j.title || '').slice(0, 120)}\nCompany: ${String(j.company || '').slice(0, 80)}\nDescription: ${String(j.description || '').replace(/\s+/g, ' ').slice(0, 700)}`,
    ).join('\n\n')

    const prompt = `You are an experienced recruiter. Judge how well THIS candidate fits EACH job.

Judge REAL fit, the way a good recruiter would:
- Reward TRANSFERABLE skills and adjacent experience, not exact keyword matches. Example: "customer support" experience is a strong fit for a "client success" or "customer experience" role even if those exact words aren't in the profile.
- Consider seniority, domain, and whether the person could realistically do and get this job.
- Do NOT penalize a candidate just because the resume lacks the job's exact wording.

Scoring guide: 80-100 = strong fit, apply now. 60-79 = good fit / worth applying. 40-59 = possible stretch. 0-39 = weak fit.

CANDIDATE PROFILE:
${profileText}

JOBS (each has an index #N):
${list}

Return ONLY a JSON array, no markdown, no extra text:
[{"i":0,"score":82,"reason":"Support + bilingual experience transfers directly"}]
The reason must be at most 12 words and explain the fit (or the gap).`

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = msg.content.find((b) => b.type === 'text')
    const raw = block && block.type === 'text' ? block.text.replace(/```json|```/g, '').trim() : '[]'
    let scores: any[] = []
    try {
      scores = JSON.parse(raw)
    } catch {
      scores = []
    }
    return NextResponse.json({ success: true, scores })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
