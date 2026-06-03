import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { saveGeneratedCV } from '@/lib/db'
import { getUserIdFromRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export const maxDuration = 60
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, { windowMs: 60_000, max: 3 })
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 60) } })
  }

  try {
    const userId = getUserIdFromRequest(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { profileText, jobText, company, role, jobUrl, language } = await req.json()
    const outputLanguage = language === 'Spanish' ? 'Spanish' : 'English'

    if (!profileText || !jobText) {
      return NextResponse.json({ error: 'Missing profile or job data' }, { status: 400 })
    }

    const prompt = `You are a world-class CV writer and ATS optimization expert with 15+ years experience helping candidates land jobs at top tech companies. Your specialty is extracting maximum value from a candidate's real experience and reframing it to match exactly what an employer is looking for.

CANDIDATE FULL PROFILE:
${profileText}

TARGET JOB:
Company: ${company || 'Not specified'}
Role: ${role || 'Not specified'}
Job Description:
${jobText}

YOUR TASK:
1. Deep-read the job description. Extract ALL keywords, required skills, preferred skills, and the tone/language style used.
2. From the candidate's profile, select the most relevant experience — not necessarily all of it.
3. Rewrite bullet points using the STAR method (Situation, Task, Action, Result) where possible. Include numbers and metrics wherever realistic based on their description.
4. Mirror the exact language and keywords from the job posting naturally — this is critical for ATS.
5. Write a summary that speaks DIRECTLY to this role — first person, confident, specific.
6. NEVER invent experience. Only use what's in the profile. Reframe and highlight, never fabricate.
7. Make it sound like a human wrote it — varied sentence structure, no corporate buzzword soup.
8. Skills section: ONLY include skills from their profile that match the job requirements. Prioritize matching the job's required and preferred skills. Do NOT include all skills—be selective and strategic.
9. ATS score: calculate honestly how well this CV matches the job (0-100).
10. Matched keywords: list the important job keywords you successfully embedded.
11. Write the entire CV in the requested language: 'English' or 'Spanish'. If Spanish is selected, use Spanish for all section headers and text, and do not mix languages.

CRITICAL ATS RULES:
- Use exact keyword phrases from the job description
- Standard section headers: Summary, Experience, Education, Skills, Certifications, Languages
- No tables, columns, graphics in the text structure
- Action verbs: Led, Built, Delivered, Improved, Managed, Developed, Implemented, Drove, Reduced, Increased

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "summary": "3-4 sentence professional summary tailored to this exact role",
  "experience": [
    {
      "title": "Exact job title",
      "company": "Company name",
      "dates": "Month Year – Month Year",
      "location": "City, Country or Remote",
      "bullets": [
        "Strong action verb + what you did + measurable result",
        "Strong action verb + what you did + measurable result",
        "Strong action verb + what you did + measurable result"
      ]
    }
  ],
  "education": [
    {
      "degree": "Full degree name",
      "school": "Institution name",
      "year": "Graduation year",
      "note": "Honors, GPA, relevant coursework (optional)"
    }
  ],
  "skills": ["skill1", "skill2"],
  "certifications": ["Name — Issuer, Year"],
  "languages": ["Language — Level"],
  "atsScore": 85,
  "matchedKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "tailoringNotes": "2-3 sentences explaining what you emphasized and why for this specific role"
}`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 })
    }

    const clean = textBlock.text.replace(/```json|```/g, '').trim()
    const cvData = JSON.parse(clean)

    try {
      const id = Math.random().toString(36).slice(2, 10)
      const now = new Date().toISOString()
      const record = {
        id,
        role: role || 'Role',
        company: company || 'Company',
        jobUrl: jobUrl || '',
        generatedAt: now,
        atsScore: cvData.atsScore || 0,
        matchedKeywords: cvData.matchedKeywords || [],
        timeSavedMinutes: 45,
        cvData,
      }
      await saveGeneratedCV(record, userId)
    } catch (e) {
      console.error('Failed to save generated CV to DB', e)
    }

    return NextResponse.json({ success: true, cvData })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
