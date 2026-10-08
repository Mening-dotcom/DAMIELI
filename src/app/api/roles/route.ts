import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// A safe, remote-friendly fallback if the profile is thin or the AI call fails.
// Broad transferable roles a LATAM-based applicant can realistically land.
const FALLBACK = ['customer service', 'customer support', 'virtual assistant', 'data entry', 'QA tester', 'IT support']

// POST /api/roles  { profileText }
// Returns 5-8 concise, remote-friendly job-title SEARCH TERMS tailored to the
// candidate — so the user never has to invent a job title themselves.
export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { windowMs: 60_000, max: 10 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }
  try {
    const { profileText } = await req.json()
    if (!profileText || String(profileText).trim().length < 20) {
      return NextResponse.json({ success: true, roles: FALLBACK, source: 'fallback' })
    }

    const prompt = `You are a remote-career coach for someone based in Costa Rica (LATAM) who applies to REMOTE jobs worldwide.

From the candidate profile below, output 6-8 SHORT job-title search terms to feed into job boards. Rules:
- Prefer REMOTE-FRIENDLY roles the person can realistically GET given their real experience and transferable skills.
- Include a mix: roles that match their background directly AND adjacent/entry roles that open doors.
- Keep each term 1-3 words, lowercase, the way a title appears on a job board (e.g. "customer support", "qa tester", "accounting assistant").
- No seniority words like "senior". No company names. No duplicates.

CANDIDATE PROFILE:
${String(profileText).slice(0, 4000)}

Return ONLY a JSON array of strings, no markdown, no extra text:
["customer support","qa tester","accounting assistant"]`

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = msg.content.find((b) => b.type === 'text')
    const raw = block && block.type === 'text' ? block.text.replace(/```json|```/g, '').trim() : '[]'
    let roles: string[] = []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        roles = parsed.map((r) => String(r || '').trim().toLowerCase()).filter(Boolean).slice(0, 8)
      }
    } catch {
      roles = []
    }
    if (!roles.length) roles = FALLBACK
    return NextResponse.json({ success: true, roles, source: 'ai' })
  } catch (err: unknown) {
    // Never block the user — fall back to a sane remote default.
    return NextResponse.json({ success: true, roles: FALLBACK, source: 'fallback-error' })
  }
}
