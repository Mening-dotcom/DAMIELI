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
      `#${i}\nTitle: ${String(j.title || '').slice(0, 120)}\nCompany: ${String(j.company || '').slice(0, 80)}\nLocation: ${String(j.location || 'n/a').slice(0, 80)}\nDescription: ${String(j.description || '').replace(/\s+/g, ' ').slice(0, 1300)}`,
    ).join('\n\n')

    const prompt = `You are an experienced recruiter helping a candidate based in COSTA RICA (Latin America). For EACH job do two things.

(1) FIT — how well the candidate fits:
- Reward TRANSFERABLE skills and adjacent experience, not exact keyword matches.
- Consider seniority and whether they could realistically do and get this job.
Scoring: 80-100 strong, 60-79 good, 40-59 stretch, 0-39 weak.

(2) ELIGIBILITY — can this Costa-Rica-based candidate, who has NO US or EU work authorization, realistically APPLY and be HIRED? Read the ACTUAL requirements:
- "no" → the job requires US/EU/other-country work authorization, residency, citizenship, security clearance, onsite/hybrid in another country, or says "US only / must reside in X".
- "yes" → remote and open worldwide / to LATAM / "anywhere" / no country-work-authorization requirement. A timezone-overlap requirement ALONE is still "yes".
- "maybe" → genuinely unclear from the text.
Be strict: if it needs work authorization in a country the candidate isn't in, it is "no".

CANDIDATE PROFILE:
${profileText}

JOBS (each has an index #N):
${list}

Return ONLY a JSON array, no markdown, no extra text:
[{"i":0,"score":82,"reason":"Support + bilingual transfers directly","eligible":"yes","eligReason":"Remote worldwide, no visa needed"}]
"reason" ≤ 12 words. "eligible" is exactly "yes", "no", or "maybe". "eligReason" ≤ 10 words.`

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3500,
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
