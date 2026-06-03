import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { rateLimit } from '@/lib/rate-limit'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { windowMs: 60_000, max: 10 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }

  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Fetch this job posting URL and extract the complete job description, company name, and job title: ${url}

Return ONLY valid JSON, no markdown:
{"company":"","role":"","description":"full job description text here"}`
      }],
    } as any)

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Could not fetch job' }, { status: 500 })
    }

    const clean = textBlock.text.replace(/```json|```/g, '').trim()
    try {
      const parsed = JSON.parse(clean)
      return NextResponse.json({ success: true, ...parsed })
    } catch {
      return NextResponse.json({ success: true, description: textBlock.text, company: '', role: '' })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
