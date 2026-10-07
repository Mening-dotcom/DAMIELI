import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/match  { profileText, jobs: [{title, company, description}] }
// Scores every job against the candidate profile in ONE batched Claude call
// (cheap + fast), returning a fit score 0-100 and a short reason per job.
export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { windowMs: 60_000, max: 5 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }
  try {
    const { profileText, jobs } = await req.json()
    if (!profileText || !Array.isArray(jobs) || jobs.length === 0) {
      return NextResponse.json({ error: 'Missing profile or jobs' }, { status: 400 })
    }

    const list = jobs.slice(0, 30).map((j: any, i: number) =>
      `#${i}\nTitle: ${String(j.title || '').slice(0, 120)}\nCompany: ${String(j.company || '').slice(0, 80)}\nDescription: ${String(j.description || '').replace(/\s+/g, ' ').slice(0, 600)}`,
    ).join('\n\n')

    const prompt = `You are a career-matching expert. Score how well EACH job fits THIS candidate, based on their real experience, skills, and seniority.

CANDIDATE PROFILE:
${profileText}

JOBS (each has an index #N):
${list}

For each job return a fit score from 0-100 (100 = perfect fit for this candidate) and a reason of at most 12 words.
Return ONLY a JSON array, no markdown, no commentary:
[{"i":0,"score":78,"reason":"Strong match on support + bilingual experience"}]`

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
