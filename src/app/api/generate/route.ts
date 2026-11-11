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

THE TRUTH CONTRACT — these rules override everything else below:
- Every single statement in the CV must be traceable to the CANDIDATE PROFILE. If it is not in the profile, it does NOT go in the CV.
- NEVER present the candidate as currently or previously holding the TARGET ROLE's title unless the profile shows that exact experience. The summary describes who they ARE (from the profile) and why that background fits the target — it never claims they already are the target role.
- Numbers and metrics ONLY if they appear in the profile. If a bullet has no metric in the profile, write a strong bullet WITHOUT a number. Never estimate, never embellish quantities.
- Job titles, company names, dates, degrees, certifications: copy them from the profile exactly. Never upgrade a title.
- If the job asks for something the profile doesn't show, bridge it with a REAL transferable skill or omit it — never invent it.
A CV with one fabricated claim can cost the candidate the job and their reputation. Truth is non-negotiable.

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
3. Rewrite bullet points using the STAR method (Situation, Task, Action, Result) where possible. Use numbers and metrics ONLY when they appear in the profile text.
4. Mirror the exact language and keywords from the job posting naturally — this is critical for ATS.
5. Write a summary that speaks DIRECTLY to this role — first person, confident, specific — while describing the candidate's REAL current identity from the profile (e.g. "customer-support professional with technical training", never "I am a [target role]").
6. NEVER invent experience. Only use what's in the profile. Reframe and highlight, never fabricate. (See THE TRUTH CONTRACT above.)
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
    let cvData = JSON.parse(clean)

    // ── Fact-check pass ──
    // A user received a CV that claimed she already held the role she was
    // applying to. Prompt rules alone don't guarantee truth, so a second pass
    // audits the draft against the profile and repairs unsupported claims
    // before the user ever sees it. If this pass fails, the draft stands.
    try {
      const auditPrompt = `You are a strict CV fact-checker. Compare the DRAFT CV (JSON) against the CANDIDATE PROFILE (the only source of truth).

Find and FIX every claim not supported by the profile:
- titles the candidate never held (especially presenting them AS the target role "${String(role || '').slice(0, 80)}")
- invented numbers/metrics/percentages not present in the profile
- skills, tools, certifications, degrees, or employers not in the profile
- upgraded seniority or responsibilities beyond what the profile states
Rewording and emphasis are FINE — only unsupported facts must change. Keep the JSON structure, keys, language (${outputLanguage}) and style identical. Fix by correcting to what the profile supports, or removing the claim.

CANDIDATE PROFILE:
${String(profileText).slice(0, 6000)}

DRAFT CV JSON:
${JSON.stringify(cvData).slice(0, 8000)}

Return ONLY the corrected full CV JSON (same schema, including atsScore/matchedKeywords/tailoringNotes). If nothing needed fixing, return the JSON unchanged.`
      const audit = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: auditPrompt }],
      })
      const auditBlock = audit.content.find(b => b.type === 'text')
      if (auditBlock && auditBlock.type === 'text') {
        const fixed = JSON.parse(auditBlock.text.replace(/```json|```/g, '').trim())
        // Sanity: only accept the audited version if it kept the core shape.
        if (fixed && typeof fixed.summary === 'string' && Array.isArray(fixed.experience)) cvData = fixed
      }
    } catch (e) {
      console.error('CV fact-check pass failed — returning unaudited draft', e)
    }

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
