'use client'
import { useState, useEffect, useRef } from 'react'
import { AppState, UserProfile, Job, Education, Certification, Language, GeneratedCV, CVData } from '@/lib/types'
import { loadState, saveState, calcProfileStrength, buildProfileText, uid, defaultProfile, defaultState } from '@/lib/state'
import { CV_TEMPLATES, renderCV } from '@/lib/templates'

const resolveTemplateId = (value?: string) => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'ats' || normalized === 'creative' || normalized === 'modern') return normalized
  return 'modern'
}

// ─── PDF export that stays readable and reflects the chosen CV style ─────
async function downloadPDF(profile: any, cvData: any, role: string, previewNode?: HTMLDivElement | null, templateId = 'modern') {
  try {
    const { jsPDF } = await import('jspdf')
    const normalizedTemplateId = resolveTemplateId(templateId)

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210, M = 15, TW = W - M * 2
    const pageHeight = doc.internal.pageSize.getHeight()
    const maxY = pageHeight - 15
    let y = 15

    const isAts = normalizedTemplateId === 'ats'
    const isCreative = normalizedTemplateId === 'creative'
    const accentColor = isCreative ? '#2563eb' : isAts ? '#1d4ed8' : '#0f766e'
    const titleColor = isCreative ? '#7dd3fc' : isAts ? '#0f172a' : '#111111'
    const bodyColor = isCreative ? '#e2e8f0' : '#333333'

    const ensureSpace = (neededSpace: number) => {
      if (y + neededSpace > maxY) {
        doc.addPage()
        y = 15
      }
    }

    const line = (text: string, size: number, bold = false, color = '#111111', indent = 0) => {
      if (!text) return
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(color)
      const width = TW - indent
      const wrapped = doc.splitTextToSize(text, width) as string[]
      wrapped.forEach((l: string) => {
        ensureSpace(size * 0.52 + 1)
        doc.text(l, M + indent, y)
        y += size * 0.52 + 0.35
      })
      y += 0.5
    }

    const section = (title: string, compact = false) => {
      ensureSpace(10)
      y += compact ? 0 : 2
      doc.setFontSize(compact ? 8 : 8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(isCreative ? '#bae6fd' : isAts ? '#0f172a' : '#444444')
      doc.text(title.toUpperCase(), M, y)
      y += compact ? 2.2 : 2.2
      doc.setDrawColor(isCreative ? '#60a5fa' : '#e5e7eb')
      doc.setLineWidth(isCreative ? 0.35 : 0.2)
      doc.line(M, y, M + TW, y)
      y += 3.2
    }

    if (profile?.name) {
      doc.setFontSize(isCreative ? 18 : isAts ? 16 : 18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(titleColor)
      doc.text(profile.name, M, y)
      y += 5.2
    }

    const contact = [profile?.email, profile?.phone, profile?.location, profile?.linkedin].filter(Boolean).join('  |   ')
    if (contact) line(contact, isCreative ? 7.2 : isAts ? 7 : 7.5, false, isCreative ? '#cbd5e1' : '#555555')
    y += 1

    if (isCreative) {
      doc.setDrawColor(accentColor)
      doc.setLineWidth(0.7)
      doc.line(M, y, M + TW * 0.55, y)
      y += 2.6
      section('Profile Snapshot', true)
      line(profile?.headline || 'Creative-focused profile', 8.8, false, '#cbd5e1')
      if (cvData?.summary) line(cvData.summary, 8.3, false, bodyColor)
    } else if (isAts) {
      section('Contact Information', true)
      line(`Email: ${profile?.email || ''}`, 8.2, false, '#333333')
      if (profile?.phone) line(`Phone: ${profile.phone}`, 8.2, false, '#333333')
      if (profile?.location) line(`Location: ${profile.location}`, 8.2, false, '#333333')
      if (profile?.linkedin) line(`LinkedIn: ${profile.linkedin}`, 8.2, false, '#333333')
      if (cvData?.summary) {
        section('Professional Summary', true)
        line(cvData.summary, 8.5, false, bodyColor)
      }
    } else if (cvData?.summary) {
      section('Professional Summary', isAts)
      line(cvData.summary, 8.8, false, bodyColor)
    }

    if (cvData?.experience && Array.isArray(cvData.experience)) {
      section('Experience', isAts)
      cvData.experience.forEach((exp: any) => {
        if (!exp) return
        ensureSpace(12)

        doc.setFontSize(9.2)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(titleColor)
        doc.text(exp.title || 'Position', M, y)
        doc.setFontSize(7.6)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#666666')
        doc.text(exp.dates || '', W - M, y, { align: 'right' })
        y += 3.6

        doc.setFontSize(8.6)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(bodyColor)
        doc.text((exp.company || '') + (exp.location ? ` — ${exp.location}` : ''), M, y)
        y += 3.6

        if (exp.bullets && Array.isArray(exp.bullets)) {
          exp.bullets.forEach((b: string) => {
            if (!b) return
            line(`• ${b}`, 8.2, false, bodyColor, isCreative ? 2 : 2)
          })
        }
        y += 1
      })
    }

    if (cvData?.education && Array.isArray(cvData.education)) {
      section('Education', isAts)
      cvData.education.forEach((e: any) => {
        if (!e) return
        ensureSpace(10)
        doc.setFontSize(9.2)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(titleColor)
        doc.text(e.degree || 'Degree', M, y)
        doc.setFontSize(7.6)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#666666')
        doc.text(e.year || '', W - M, y, { align: 'right' })
        y += 3.6
        doc.setFontSize(8.4)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(bodyColor)
        doc.text(e.school || '', M, y)
        y += 3.6
        if (e.note) line(e.note, 7.8, false, isCreative ? '#cbd5e1' : '#555555')
        y += 0.8
      })
    }

    if (cvData?.skills && Array.isArray(cvData.skills) && cvData.skills.length > 0) {
      section('Skills', isAts)
      line(cvData.skills.join('  •  '), 8.2, false, bodyColor)
    }

    if (cvData?.certifications && Array.isArray(cvData.certifications) && cvData.certifications.length > 0) {
      section('Certifications', isAts)
      line(cvData.certifications.join('  •  '), 8.2, false, bodyColor)
    }

    if (cvData?.languages && Array.isArray(cvData.languages) && cvData.languages.length > 0) {
      section('Languages', isAts)
      line(cvData.languages.join('  |   '), 8.2, false, bodyColor)
    }

    doc.save(`${(profile?.name || 'CV').replace(/ /g, '_')}_${(templateId || 'modern').toUpperCase()}_CV.pdf`)
  } catch (error) {
    console.error('PDF Generation crashed:', error)
  }
}

async function downloadWord(profile: UserProfile, cvData: CVData, role: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } = await import('docx')

  const contact = [profile.email, profile.phone, profile.location, profile.linkedin].filter(Boolean).join('  |  ')

  const sectionHeading = (text: string) => new Paragraph({
    text: text.toUpperCase(),
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 100 },
    border: { bottom: { color: 'DDDDDD', style: BorderStyle.SINGLE, size: 6 } },
    run: { font: 'Calibri', size: 18, bold: true, color: '555555' },
  })

  const children: any[] = [
    new Paragraph({
      children: [new TextRun({ text: profile.name, bold: true, size: 44, font: 'Calibri' })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
    }),
    ...(contact ? [new Paragraph({ children: [new TextRun({ text: contact, size: 18, color: '555555', font: 'Calibri' })], spacing: { after: 200 } })] : []),
  ]

  if (cvData.summary) {
    children.push(sectionHeading('Professional Summary'))
    children.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 20, font: 'Calibri' })], spacing: { after: 200 } }))
  }

  if (cvData.experience?.length) {
    children.push(sectionHeading('Experience'))
    cvData.experience.forEach(exp => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: exp.title, bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `  ${exp.dates || ''}`, size: 18, color: '777777', font: 'Calibri' }),
        ],
        spacing: { before: 200, after: 60 },
      }))
      children.push(new Paragraph({ children: [new TextRun({ text: exp.company + (exp.location ? ` — ${exp.location}` : ''), italics: true, size: 20, color: '444444', font: 'Calibri' })], spacing: { after: 100 } }))
      exp.bullets?.forEach(b => {
        children.push(new Paragraph({ children: [new TextRun({ text: b, size: 20, font: 'Calibri' })], bullet: { level: 0 }, spacing: { after: 60 } }))
      })
    })
  }

  if (cvData.education?.length) {
    children.push(sectionHeading('Education'))
    cvData.education.forEach(e => {
      children.push(new Paragraph({ children: [new TextRun({ text: e.degree, bold: true, size: 22, font: 'Calibri' }), new TextRun({ text: `  ${e.year || ''}`, size: 18, color: '777777', font: 'Calibri' })], spacing: { before: 200, after: 60 } }))
      children.push(new Paragraph({ children: [new TextRun({ text: e.school, italics: true, size: 20, color: '444444', font: 'Calibri' })], spacing: { after: e.note ? 60 : 120 } }))
      if (e.note) children.push(new Paragraph({ children: [new TextRun({ text: e.note, size: 18, color: '555555', font: 'Calibri' })], spacing: { after: 120 } }))
    })
  }

  if (cvData.skills?.length) {
    children.push(sectionHeading('Skills'))
    children.push(new Paragraph({ children: [new TextRun({ text: cvData.skills.join(' • '), size: 20, font: 'Calibri' })], spacing: { after: 200 } }))
  }

  if (cvData.certifications?.length) {
    children.push(sectionHeading('Certifications'))
    cvData.certifications.forEach(c => children.push(new Paragraph({ children: [new TextRun({ text: c, size: 20, font: 'Calibri' })], bullet: { level: 0 }, spacing: { after: 60 } })))
  }

  if (cvData.languages?.length) {
    children.push(sectionHeading('Languages'))
    children.push(new Paragraph({ children: [new TextRun({ text: cvData.languages.join('  |  '), size: 20, font: 'Calibri' })], spacing: { after: 200 } }))
  }

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }] })
  const buffer = await Packer.toBlob(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(buffer)
  a.download = `${profile.name.replace(/ /g, '_')}_CV_${role.replace(/ /g, '_')}.docx`
  a.click()
}

// ─── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState<AppState>({ profile: defaultProfile, history: [], stats: { cvsGenerated: 0, jobsAnalyzed: 0, totalTimeSaved: 0 }, templateId: 'modern', outputLanguage: 'English' })
  const [screen, setScreen] = useState<'home' | 'jobs' | 'settings' | 'profile' | 'generate' | 'history'>('home')
  const [modal, setModal] = useState<string | null>(null)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState('')
  const [currentCV, setCurrentCV] = useState<GeneratedCV | null>(null)
  const [jobUrl, setJobUrl] = useState('')
  const [jobText, setJobText] = useState('')
  const [jobCompany, setJobCompany] = useState('')
  const [jobRole, setJobRole] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  // --- Jobs tab state (job discovery) ---
  const [jobsList, setJobsList] = useState<any[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState('')
  const [jobsPage, setJobsPage] = useState(1)
  const [expandedJob, setExpandedJob] = useState<number | null>(null)
  const [matching, setMatching] = useState(false)
  const [rolesLoading, setRolesLoading] = useState(false)
  const [jobsSources, setJobsSources] = useState(0)
  const JOBS_PER_PAGE = 8
  // Remote-friendly starter roles — replaced automatically from the user's
  // profile the first time they open the Jobs tab (see auto-pick effect).
  const [searchPrefs, setSearchPrefs] = useState({ modality: 'remote', seniority: 'Junior', minSalary: 0, zone: '', keywords: 'customer service, customer support, virtual assistant, data entry, QA tester, IT support', onlyApplyable: true })
  useEffect(() => {
    try {
      const r = typeof window !== 'undefined' ? window.localStorage.getItem('damieli_search_prefs') : null
      if (r) setSearchPrefs(prev => ({ ...prev, ...JSON.parse(r) }))
    } catch { /* ignore */ }
  }, [])
  // Saved / Applied tracking (per job, persisted locally)
  const [jobStatusMap, setJobStatusMap] = useState<Record<string, string>>({})
  const [jobView, setJobView] = useState<'all' | 'saved' | 'applied' | 'hidden'>('all')
  useEffect(() => {
    try {
      const r = typeof window !== 'undefined' ? window.localStorage.getItem('damieli_job_status') : null
      if (r) setJobStatusMap(JSON.parse(r))
    } catch { /* ignore */ }
  }, [])
  function markJob(job: any, status: 'saved' | 'applied' | 'hidden') {
    const key = String(job.url || job.title || '')
    setJobStatusMap((prev) => {
      const next = { ...prev }
      if (next[key] === status) delete next[key] // tap again to clear
      else next[key] = status
      try { window.localStorage.setItem('damieli_job_status', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }
  function salaryToNumber(txt: any): number | null {
    if (!txt) return null
    const nums = String(txt).replace(/[,.]/g, '').match(/\d{3,}/g)
    if (!nums || !nums.length) return null
    return Math.max.apply(null, nums.map((n: string) => parseInt(n, 10)))
  }
  async function loadJobs(prefs = searchPrefs) {
    setJobsLoading(true); setJobsError(''); setExpandedJob(null)
    try {
      const q = new URLSearchParams()
      if (prefs.modality && prefs.modality !== 'any') q.set('locationType', prefs.modality)
      if (prefs.seniority) q.set('seniority', prefs.seniority)
      // The role terms drive what each job site actually searches for.
      if (prefs.keywords && prefs.keywords.trim()) q.set('roles', prefs.keywords.trim())
      const res = await fetch('/api/search?' + q.toString(), { cache: 'no-store' })
      const data = await res.json()
      if (!data.success) { setJobsError(data.error || 'Failed to load jobs'); return }
      setJobsSources(data.sources || 0)
      let list: any[] = data.jobs || []
      const zone = (prefs.zone || '').trim().toLowerCase()
      // Tokenize role terms into individual words (len >= 3) so a job matches
      // on any meaningful word — "QA tester" still catches "Quality Assurance
      // Tester" via "tester" — instead of needing the exact phrase.
      const kws = (prefs.keywords || '').split(/[,\s]+/).map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length >= 3)
      const minSal = Number(prefs.minSalary) || 0
      list = list.filter((j: any) => {
        if (zone && !String(j.location || '').toLowerCase().includes(zone)) return false
        if (kws.length) {
          const hay = (String(j.title) + ' ' + String(j.company) + ' ' + String(j.description)).toLowerCase()
          if (!kws.some((k: string) => hay.includes(k))) return false
        }
        if (minSal > 0) { const n = salaryToNumber(j.salaryText); if (n !== null && n < minSal) return false }
        return true
      })
      // Rank the clearly-applyable-from-Costa-Rica jobs to the top: LATAM and
      // Worldwide first, unknown next, US-authorization-required last. Stable
      // sort keeps newest-first order within each group.
      const rank: Record<string, number> = { latam: 0, worldwide: 1, unknown: 2, us_only: 3 }
      list.sort((a: any, b: any) => (rank[a.eligibility] ?? 2) - (rank[b.eligibility] ?? 2))
      setJobsList(list); setJobsPage(1)
    } catch (e: any) {
      setJobsError(e?.message || 'Failed to load jobs')
    } finally {
      setJobsLoading(false)
    }
  }
  // Ask the AI to pick remote-friendly role search terms from the user's own
  // profile — so they never have to invent a job title. Returns a comma string
  // (or null on failure). The endpoint always falls back to a sane default.
  async function suggestRoles(): Promise<string | null> {
    try {
      const profileText = buildProfileText(state.profile)
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileText }),
      })
      const data = await res.json()
      if (data && data.success && Array.isArray(data.roles) && data.roles.length) {
        return data.roles.join(', ')
      }
    } catch { /* ignore — caller keeps current roles */ }
    return null
  }
  // Manual "re-pick" button in Settings.
  async function autoPickRoles() {
    setRolesLoading(true)
    try {
      const roles = await suggestRoles()
      if (roles) {
        const next = { ...searchPrefs, keywords: roles }
        setSearchPrefs(next)
        try { window.localStorage.setItem('damieli_search_prefs', JSON.stringify(next)) } catch { /* ignore */ }
      }
    } finally {
      setRolesLoading(false)
    }
  }
  // Semantic match scoring — one on-demand Claude call that judges REAL fit
  // (transferable skills), not keyword overlap. Runs only when you click.
  async function scoreMatches() {
    if (!jobsList.length || matching) return
    setMatching(true); setJobsError('')
    try {
      const profileText = buildProfileText(state.profile)
      if (!profileText || profileText.trim().length < 20) {
        setJobsError('Add your experience in the Profile tab first — matching needs your background.')
        return
      }
      const res = await fetch('/api/match', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileText, jobs: jobsList.map((j: any) => ({ title: j.title, company: j.company, description: j.description })) }),
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.scores)) {
        const byIdx = new Map<number, any>(data.scores.map((s: any) => [Number(s.i), s] as [number, any]))
        const scored = jobsList.map((j: any, i: number) => {
          const s = byIdx.get(i)
          return { ...j, score: s && typeof s.score === 'number' ? s.score : null, reason: s && s.reason ? String(s.reason) : '' }
        })
        scored.sort((a: any, b: any) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score))
        setJobsList(scored); setJobsPage(1); setExpandedJob(null)
      } else {
        setJobsError(data.error || 'Matching failed')
      }
    } catch (e: any) {
      setJobsError(e?.message || 'Matching failed')
    } finally {
      setMatching(false)
    }
  }
  const [skillInput, setSkillInput] = useState('')
  const [cvTab, setCvTab] = useState<'preview' | 'raw'>('preview')
  const [tailoringNotes, setTailoringNotes] = useState('')
  const [serverHistory, setServerHistory] = useState<GeneratedCV[]>([])
  const [showUploadCV, setShowUploadCV] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('modern')
  const [outputLanguage, setOutputLanguage] = useState<'English' | 'Spanish'>('English')
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null)
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authStatus, setAuthStatus] = useState('')
  const [syncStatus, setSyncStatus] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<AppState>(state)
  const currentUserRef = useRef<{ id: string; email: string } | null>(currentUser)

  // Form state for modals
  const [jobForm, setJobForm] = useState<Partial<Job>>({})
  const [eduForm, setEduForm] = useState<Partial<Education>>({})
  const [certForm, setCertForm] = useState<Partial<Certification>>({})
  const [langForm, setLangForm] = useState<Partial<Language>>({})

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  // First time the Jobs tab opens, auto-pick role search terms from the user's
  // profile (so they never invent a job title), then load jobs. Runs once per
  // device; after that it respects whatever roles the user has set.
  const rolesAutoRan = useRef(false)
  useEffect(() => {
    if (screen !== 'jobs' || rolesAutoRan.current) return
    rolesAutoRan.current = true
    let already = false
    try { already = window.localStorage.getItem('damieli_roles_auto') === '1' } catch { /* ignore */ }
    if (already) {
      if (!jobsList.length && !jobsLoading) loadJobs()
      return
    }
    void (async () => {
      const roles = await suggestRoles()
      const nextPrefs = roles ? { ...searchPrefs, keywords: roles } : searchPrefs
      if (roles) {
        setSearchPrefs(nextPrefs)
        try { window.localStorage.setItem('damieli_search_prefs', JSON.stringify(nextPrefs)) } catch { /* ignore */ }
      }
      try { window.localStorage.setItem('damieli_roles_auto', '1') } catch { /* ignore */ }
      loadJobs(nextPrefs)
    })()
  }, [screen])

  const hasMeaningfulProfile = (profile?: Partial<UserProfile>) => {
    if (!profile) return false
    const textFields = [profile.name, profile.headline, profile.email, profile.phone, profile.location, profile.linkedin, profile.portfolio, profile.summary, profile.achievements, profile.uploadedCVText]
    if (textFields.some(value => typeof value === 'string' && value.trim())) return true
    return Boolean(profile.jobs?.length || profile.education?.length || profile.certifications?.length || profile.languages?.length || profile.skills?.length)
  }

  const fetchServerState = async (userId?: string | null) => {
    const activeUserId = userId ?? currentUserRef.current?.id
    if (!activeUserId) return
    try {
      const [profileRes, historyRes] = await Promise.all([
        fetch('/api/profile', { credentials: 'include' }),
        fetch('/api/history', { credentials: 'include' }),
      ])
      const profileData = await profileRes.json()
      const historyData = await historyRes.json()

      if (historyData.success) {
        setServerHistory(historyData.history)
      }

      const localState = loadState()
      const latestState = stateRef.current
      const localHasProfileData = hasMeaningfulProfile(localState.profile) || localState.history.length > 0
      const serverState = profileData.success ? profileData.state : null
      const serverProfile = serverState?.profile || {}
      const serverStats = serverState?.stats || latestState.stats
      const serverHistory = serverState?.history || (historyData.success ? historyData.history : localState.history)
      const serverTemplateId = serverState?.templateId || localState.templateId || defaultState.templateId
      const serverOutputLanguage = serverState?.outputLanguage || localState.outputLanguage || defaultState.outputLanguage
      const localIsDefault = localState.profile.name === defaultProfile.name && localState.history.length === 0
      const localHasMeaningfulData = hasMeaningfulProfile(localState.profile)
      const serverHasProfileData = hasMeaningfulProfile(serverProfile)

      if (serverHasProfileData || localIsDefault || !localHasMeaningfulData) {
        const mergedState: AppState = {
          profile: serverHasProfileData ? { ...defaultProfile, ...serverProfile } : { ...defaultProfile, ...localState.profile },
          history: serverHistory,
          stats: { ...latestState.stats, ...localState.stats, ...serverStats },
          templateId: serverTemplateId,
          outputLanguage: serverOutputLanguage,
        }
        setSelectedTemplate(resolveTemplateId(mergedState.templateId))
        setOutputLanguage((mergedState.outputLanguage || 'English') as 'English' | 'Spanish')
        save(mergedState)
      } else if (localHasProfileData) {
        const mergedState: AppState = {
          profile: { ...defaultProfile, ...localState.profile },
          history: serverHistory,
          stats: { ...latestState.stats, ...localState.stats, ...stateRef.current.stats },
          templateId: serverTemplateId,
          outputLanguage: serverOutputLanguage,
        }
        setSelectedTemplate(resolveTemplateId(mergedState.templateId))
        setOutputLanguage((mergedState.outputLanguage || 'English') as 'English' | 'Spanish')
        save(mergedState)
        await saveToServer(mergedState, activeUserId)
      }
    } catch {
      // ignore server state errors in the UI
    }
  }

  const fetchAuthState = async () => {
    try {
      setSyncStatus('Checking account...')
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      const data = await res.json()
      if (data.success && data.user) {
        setCurrentUser(data.user)
        await fetchServerState(data.user.id)
        setSyncStatus('Profile restored from your account.')
      } else {
        setCurrentUser(null)
        setSyncStatus('')
      }
    } catch {
      setCurrentUser(null)
      setSyncStatus('Unable to connect to account sync.')
    }
  }

  useEffect(() => {
    const loaded = loadState()
    setState(loaded)
    setSelectedTemplate(resolveTemplateId(loaded.templateId))
    setOutputLanguage((loaded.outputLanguage || 'English') as 'English' | 'Spanish')
    fetchAuthState()
  }, [])

  useEffect(() => {
    const updateViewport = () => {
      const mobile = window.innerWidth < 900
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(false)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  const saveToServer = async (s: AppState, userId?: string) => {
    const activeUserId = userId || currentUserRef.current?.id
    if (!activeUserId) return
    try {
      await fetch('/api/profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: s.profile,
          stats: s.stats,
          history: s.history,
          templateId: resolveTemplateId(s.templateId || selectedTemplate || 'modern'),
          outputLanguage: s.outputLanguage || outputLanguage,
        }),
      })
    } catch {
      // fail silently, keep local copy
    }
  }

  const save = (s: AppState) => {
    const nextState: AppState = {
      ...s,
      templateId: resolveTemplateId(s.templateId || selectedTemplate || 'modern'),
      outputLanguage: s.outputLanguage || outputLanguage || 'English',
    }
    setState(nextState)
    saveState(nextState)
    void saveToServer(nextState)
  }

  const updateProfile = (p: Partial<UserProfile>) => save({ ...state, profile: { ...state.profile, ...p } })
  const updateAppState = (patch: Partial<AppState>) => save({ ...state, ...patch })
  const updateTemplateSelection = (templateId: string) => {
    const normalizedTemplateId = resolveTemplateId(templateId)
    setSelectedTemplate(normalizedTemplateId)
    save({ ...state, templateId: normalizedTemplateId })
  }

  const shouldSaveLocalStateToServer = (s: AppState) => {
    return hasMeaningfulProfile(s.profile) || s.history.length > 0
  }

  const authRequest = async (mode: 'login' | 'signup') => {
    setAuthLoading(true)
    setAuthStatus('')
    try {
      const payload = { email: authEmail.trim().toLowerCase(), password: authPassword }
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!data.success) {
        if (mode === 'signup' && data.error === 'User already exists') {
          setAuthStatus('This email already has an account. Please use Login instead.')
          return
        }
        setAuthStatus(data.error || 'Unable to authenticate')
        return
      }

      if (data.user) {
        setCurrentUser(data.user)
        setAuthModal(null)
        setAuthEmail('')
        setAuthPassword('')
        setAuthStatus('')
        setSyncStatus('Signing in and syncing profile...')
        await fetchServerState(data.user.id)
        if (shouldSaveLocalStateToServer(stateRef.current)) {
          await saveToServer(stateRef.current, data.user.id)
        }
        setSyncStatus('Profile restored from your account.')
      }
    } catch (error) {
      setAuthStatus(error instanceof Error ? error.message : 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // ignore
    }
    setCurrentUser(null)
    setServerHistory([])
  }
  const updateOutputLanguage = (language: 'English' | 'Spanish') => {
    setOutputLanguage(language)
    save({ ...state, outputLanguage: language })
  }

  const strength = calcProfileStrength(state.profile)
  const effectiveTemplateId = resolveTemplateId(currentCV?.templateId || selectedTemplate || state.templateId || 'modern')
  const responsiveStatsGrid = isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))'
  const responsiveSplitGrid = isMobile ? '1fr' : '1.4fr 1fr'
  const responsiveTwoColGrid = isMobile ? '1fr' : '1fr 1fr'
  const responsiveThreeColGrid = isMobile ? '1fr' : '1fr 1fr 1fr'
  const responsiveTemplateGrid = isMobile ? '1fr' : 'repeat(3, 1fr)'

  // ── Job fetch ──
  const fetchJob = async () => {
    if (!jobUrl) return
    setFetchingUrl(true)
    try {
      const res = await fetch('/api/fetch-job', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: jobUrl }) })
      const data = await res.json()
      if (data.description) setJobText(data.description)
      if (data.company) setJobCompany(data.company)
      if (data.role) setJobRole(data.role)
    } catch { setGenStatus('Could not auto-fetch. Paste the job text manually.') }
    setFetchingUrl(false)
  }

  // ── Generate CV ──
  const generate = async () => {
    if (!currentUser) { alert('Please sign in first to generate a CV.'); setAuthModal('login'); return }
    if (!jobText.trim()) { alert('Paste the job description first.'); return }
    if (!state.profile.name) { alert('Add your name to the profile first.'); setScreen('profile'); return }
    setGenerating(true); setCurrentCV(null); setGenStatus('Analyzing job requirements...')
    try {
      setGenStatus('Fine-tuning your CV for this role...')
      const profileText = buildProfileText(state.profile)
      const res = await fetch('/api/generate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileText, jobText, company: jobCompany, role: jobRole, jobUrl, language: outputLanguage }) })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Generation failed')
      const cv: GeneratedCV = {
        id: uid(),
        role: jobRole || 'Role',
        company: jobCompany || 'Company',
        jobUrl,
        generatedAt: new Date().toLocaleString(),
        atsScore: data.cvData.atsScore || 80,
        matchedKeywords: data.cvData.matchedKeywords || [],
        timeSavedMinutes: 45,
        cvData: data.cvData,
        templateId: resolveTemplateId(selectedTemplate),
      }
      setTailoringNotes(data.cvData.tailoringNotes || '')
      setCurrentCV(cv)
      setCvTab('preview')
      const newHistory = [cv, ...state.history].slice(0, 50)
      save({
        ...state,
        history: newHistory,
        stats: { ...state.stats, cvsGenerated: state.stats.cvsGenerated + 1, jobsAnalyzed: state.stats.jobsAnalyzed + 1, totalTimeSaved: state.stats.totalTimeSaved + 45 },
        templateId: resolveTemplateId(selectedTemplate),
        outputLanguage,
      })
      setGenStatus('done')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setGenStatus('Error: ' + msg)
    }
    setGenerating(false)
  }

  // ── CV text ──
  const buildRawText = (cv: GeneratedCV) => {
    const templateId = resolveTemplateId(cv.templateId || selectedTemplate || state.templateId || 'modern')
    return renderCV(state.profile, cv.cvData, templateId)
  }

  // ── Upload CV text ──
  const handleCVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { updateProfile({ uploadedCVText: ev.target?.result as string }); setShowUploadCV(false) }
    reader.readAsText(file)
  }

  // ─── RENDER ────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: '100vh', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Sidebar */}
      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(255,255,255,0.96)', borderBottom: '1px solid rgba(15,23,42,0.08)', backdropFilter: 'blur(8px)' }}>
          <button onClick={() => setSidebarOpen(v => !v)} style={{ border: '1px solid rgba(15,23,42,0.12)', background: '#fff', color: '#0b3d91', borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>☰</button>
          <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 800, color: '#0b3d91' }}>DAMIELI</div>
        </div>
      )}
      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 20 }} />}
      <nav style={{ width: isMobile ? '85%' : 240, maxWidth: isMobile ? 300 : 240, background: 'linear-gradient(165deg, #1e3a8a 0%, #4f46e5 50%, #be185d 120%)', borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.12)', display: isMobile ? (sidebarOpen ? 'flex' : 'none') : 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, height: '100vh', zIndex: isMobile ? 40 : 25, padding: '22px 0', overflowY: 'auto' }}>
        <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontFamily: 'Syne', fontSize: 24, fontWeight: 900, color: '#ffffff', letterSpacing: -1 }}>DAMIELI</div>
          <div style={{ fontSize: 12, color: '#c4ccf8', marginTop: 4, maxWidth: 200 }}>Fast resume studio with easy CV creation and clean downloads.</div>
          {syncStatus ? <div style={{ marginTop: 10, fontSize: 11, color: '#bfdbfe', lineHeight: 1.4 }}>{syncStatus}</div> : null}
        </div>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {currentUser ? (
            <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.5 }}>
              Signed in as <strong style={{ color: '#dbeafe' }}>{currentUser.email}</strong>
            </div>
          ) : (
            <div style={{ color: '#fff', fontSize: 12, lineHeight: 1.5 }}>Sign in to save your profile and history securely.</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {currentUser ? (
              <button onClick={logout} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: '#0ea5e9', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12 }}>Logout</button>
            ) : (
              <>
                <button onClick={() => setAuthModal('login')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: '#38bdf8', color: '#0f172a', border: 'none', cursor: 'pointer', fontSize: 12 }}>Login</button>
                <button onClick={() => setAuthModal('signup')} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: '#f8fafc', color: '#0f172a', border: 'none', cursor: 'pointer', fontSize: 12 }}>Sign up</button>
              </>
            )}
          </div>
        </div>
        <div style={{ padding: '18px 14px', flex: 1 }}>
          {(['home', 'jobs', 'settings', 'profile', 'generate', 'history'] as const).map((s, i) => {
            const labels = ['Dashboard', 'Jobs', 'Settings', 'Profile', 'Generate', 'History']
            const icons = ['◈', '🔎', '⚙', '◉', '⚡', '◎']
            return (
              <button key={s} onClick={() => { setScreen(s); if (s === 'jobs' && jobsList.length === 0) loadJobs(); if (isMobile) setSidebarOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 8, background: screen === s ? 'rgba(255,255,255,0.18)' : 'transparent', color: screen === s ? '#fff' : '#c7d2fe', fontFamily: 'DM Sans', fontWeight: screen === s ? 700 : 500, transition: 'all 0.15s' }}>
                <span style={{ fontSize: 13 }}>{icons[i]}</span> {labels[i]}
              </button>
            )
          })}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: '#c4ccf8', lineHeight: 1.6 }}>
          Created by Steven M<br />
          <span style={{ color: 'var(--success)' }}>●</span> {state.stats.cvsGenerated} CVs generated<br />
          <span style={{ color: 'var(--info)' }}>⏱</span> {state.stats.totalTimeSaved}m saved
        </div>
      </nav>

      {/* Main */}
      <main style={{ marginLeft: isMobile ? 0 : 240, flex: 1, padding: isMobile ? '20px 16px 32px' : '32px 40px', maxWidth: 1040, width: '100%', overflowX: 'hidden', paddingTop: isMobile ? 18 : '32px' }}>

        {/* ── HOME ── */}
        {screen === 'home' && (
          <div className="fade-in">
            <div style={{ marginBottom: 28, display: 'grid', gap: 20 }}>
              <div style={{ padding: '30px 34px', borderRadius: 24, background: 'rgba(5,70,90,0.96)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 28px 70px rgba(0,0,0,0.12)' }}>
                <h1 style={{ fontSize: 38, fontWeight: 900, letterSpacing: -0.9, marginBottom: 12, color: '#fff' }}>Faster CV creation with polished downloads.</h1>
                <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.7, maxWidth: 760, marginBottom: 16 }}>A fast workspace for building your profile, matching jobs, and exporting ready-to-use resumes in PDF or Word.</p>
                <div style={{ display: 'grid', gridTemplateColumns: responsiveStatsGrid, gap: 12, marginTop: 12 }}>
                  {[
                    { label: 'Fast resume drafts', value: '30 sec' },
                    { label: 'Tailored job matches', value: state.stats.cvsGenerated + ' done' },
                    { label: 'History saved', value: state.stats.totalTimeSaved + 'm' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '18px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}> {item.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: responsiveSplitGrid, gap: 18 }}>
                <div style={{ padding: '26px 28px', borderRadius: 22, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: '#0b3d91', marginBottom: 12 }}>Your next move</div>
                  <div style={{ fontSize: 15, color: '#0b3d91', lineHeight: 1.75, marginBottom: 16 }}>Build your profile, match jobs, and export resume files in one clean workflow.</div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {['Update your profile', 'Paste a job description', 'Generate a tailored CV', 'Download ready resume files'].map(line => (
                      <div key={line} style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#0b3d91', fontSize: 13 }}>
                        <span style={{ width: 20, height: 20, borderRadius: 999, background: 'rgba(56,189,248,0.3)', display: 'grid', placeItems: 'center', color: '#ecfeff', fontSize: 12 }}>✓</span>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '26px 28px', borderRadius: 22, background: 'rgba(7,90,108,0.96)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--info)', marginBottom: 12 }}>Features</div>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: '#e7e5df' }}>A fast, focused dashboard made for clean CV creation and export.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(56,189,248,0.16)', border: '1px solid rgba(56,189,248,0.24)', color: '#fff' }}>Create CVs in English or Spanish with one tap.</div>
                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--muted)' }}>Save your profile, match jobs, and export resumes instantly.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: responsiveStatsGrid, gap: 14, marginBottom: 24 }}>
              {[
                { val: state.stats.cvsGenerated, label: 'CVs generated', color: '#38bdf8', icon: '⚡' },
                { val: state.stats.jobsAnalyzed, label: 'Jobs analyzed', color: '#2dd4bf', icon: '🎯' },
                { val: state.stats.totalTimeSaved + 'm', label: 'Time saved', color: '#22c55e', icon: '⏱️' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 12, padding: '20px', boxShadow: '0 10px 30px rgba(6, 58, 75, 0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
                    <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#0f172a', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Profile strength */}
            {strength < 100 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>Profile strength</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{strength}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--surface3)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: strength + '%', background: 'var(--accent)', borderRadius: 100, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {[
                    { label: 'Basic info', done: !!(state.profile.name && state.profile.email) },
                    { label: 'Work experience', done: state.profile.jobs.length > 0 },
                    { label: 'Education', done: state.profile.education.length > 0 },
                    { label: 'Skills', done: state.profile.skills.length >= 5 },
                    { label: 'Languages', done: state.profile.languages.length > 0 },
                    { label: 'Summary', done: state.profile.summary.length > 50 },
                  ].map(item => (
                    <span key={item.label} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 100, background: item.done ? 'rgba(200,240,74,0.12)' : 'var(--surface3)', color: item.done ? 'var(--accent)' : 'var(--muted)' }}>
                      {item.done ? '✓ ' : ''}{item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: responsiveTwoColGrid, gap: 12, marginBottom: 20 }}>
              {[
                { icon: '⚡', title: 'Generate CV', sub: 'Paste a job URL or description and get a tailored CV in 30 seconds', action: () => setScreen('generate') },
                { icon: '👤', title: 'Build Profile', sub: 'Add all your experience — past jobs, courses, languages, everything', action: () => setScreen('profile') },
              ].map(q => (
                <div key={q.title} onClick={q.action} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{q.icon}</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{q.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{q.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(56,189,248,0.24)', borderRadius: 18, padding: '20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, color: '#0b3d91', marginBottom: 6 }}>CV language</div>
                <div style={{ fontSize: 13, color: '#0b3d91' }}>Choose the language used when generating your tailored CV.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto' }}>
                {(['English', 'Spanish'] as const).map(lang => (
                  <button key={lang} onClick={() => updateOutputLanguage(lang)} style={{ padding: '10px 18px', borderRadius: 999, border: outputLanguage === lang ? '1px solid #0b3d91' : '1px solid rgba(13,110,253,0.2)', background: outputLanguage === lang ? '#0b7cde' : 'rgba(255,255,255,0.12)', color: outputLanguage === lang ? '#fff' : '#0b3d91', cursor: 'pointer', fontSize: 13, minWidth: isMobile ? '100%' : 100 }}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(56,189,248,0.14)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#0f172a', lineHeight: 1.7 }}>
              <span style={{ color: '#0284c7', fontWeight: 600 }}>Pro tip:</span> Add every job you&apos;ve ever had — even unrelated ones. More detail means a smarter, sharper CV for the role you want.
            </div>
          </div>
        )}

        {/* ── PROFILE ── */}
        {screen === 'profile' && (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4, color: '#0b3d91' }}>My Profile</h1>
              <p style={{ color: '#0b3d91', fontSize: 13 }}>The richer your profile, the better every generated CV will be. Add your experience, skills, and projects.</p>
            </div>

            {/* Upload CV */}
            <div style={{ background: 'rgba(95,184,255,0.05)', border: '1px solid rgba(95,184,255,0.2)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, color: '#0b3d91' }}>Upload existing CV</div>
                <div style={{ fontSize: 12, color: '#0b3d91', marginTop: 2 }}>
                  {state.profile.uploadedCVText ? '✓ CV text loaded — the generator will use this as additional context' : 'Import your existing CV (.txt) to provide more context'}
                </div>
              </div>
              <button onClick={() => fileRef.current?.click()} style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(95,184,255,0.12)', color: 'var(--info)', border: '1px solid rgba(95,184,255,0.25)', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans' }}>
                {state.profile.uploadedCVText ? 'Replace' : 'Upload .txt'}
              </button>
              <input ref={fileRef} type="file" accept=".txt" style={{ display: 'none' }} onChange={handleCVUpload} />
            </div>

            {/* Personal Info */}
            <Card title="Personal Info">
              <div style={{ display: 'grid', gridTemplateColumns: responsiveTwoColGrid, gap: 14 }}>
                <Field label="Full name"><Input value={state.profile.name} onChange={v => updateProfile({ name: v })} placeholder="Steven" /></Field>
                <Field label="Job title / headline"><Input value={state.profile.headline} onChange={v => updateProfile({ headline: v })} placeholder="Software Engineer" /></Field>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Change your name anytime — this is the name used on all downloads and saved CV previews.</div>
              <div style={{ display: 'grid', gridTemplateColumns: responsiveThreeColGrid, gap: 14 }}>
                <Field label="Email"><Input value={state.profile.email} onChange={v => updateProfile({ email: v })} placeholder="steven@email.com" /></Field>
                <Field label="Phone"><Input value={state.profile.phone} onChange={v => updateProfile({ phone: v })} placeholder="+506 ..." /></Field>
                <Field label="Location"><Input value={state.profile.location} onChange={v => updateProfile({ location: v })} placeholder="San José, CR" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="LinkedIn URL"><Input value={state.profile.linkedin} onChange={v => updateProfile({ linkedin: v })} placeholder="linkedin.com/in/steven" /></Field>
                <Field label="Portfolio / GitHub"><Input value={state.profile.portfolio} onChange={v => updateProfile({ portfolio: v })} placeholder="github.com/steven" /></Field>
              </div>
              <Field label="Professional summary — your elevator pitch (the generator adapts this per job)">
                <textarea value={state.profile.summary} onChange={e => updateProfile({ summary: e.target.value })} rows={3} placeholder="Results-driven software engineer with 5+ years building scalable systems..." style={textareaStyle} />
              </Field>
            </Card>

            {/* Work Experience */}
            <Card title={`Work Experience (${state.profile.jobs.length})`}>
              {state.profile.jobs.map((j, i) => (
                <EntryItem key={j.id} title={j.title} sub={`${j.company} · ${j.start} – ${j.end || 'Present'}`}
                  onEdit={() => { setJobForm(j); setEditIdx(i); setModal('job') }}
                  onDelete={() => { const jobs = [...state.profile.jobs]; jobs.splice(i, 1); updateProfile({ jobs }) }} />
              ))}
              <AddBtn onClick={() => { setJobForm({}); setEditIdx(null); setModal('job') }}>+ Add position</AddBtn>
            </Card>

            {/* Education */}
            <Card title={`Education (${state.profile.education.length})`}>
              {state.profile.education.map((e, i) => (
                <EntryItem key={e.id} title={e.degree} sub={`${e.school} · ${e.endYear}`}
                  onEdit={() => { setEduForm(e); setEditIdx(i); setModal('edu') }}
                  onDelete={() => { const education = [...state.profile.education]; education.splice(i, 1); updateProfile({ education }) }} />
              ))}
              <AddBtn onClick={() => { setEduForm({}); setEditIdx(null); setModal('edu') }}>+ Add education</AddBtn>
            </Card>

            {/* Certifications */}
            <Card title={`Courses & Certifications (${state.profile.certifications.length})`}>
              {state.profile.certifications.map((c, i) => (
                <EntryItem key={c.id} title={c.name} sub={`${c.issuer}${c.date ? ' · ' + c.date : ''}`}
                  onEdit={() => { setCertForm(c); setEditIdx(i); setModal('cert') }}
                  onDelete={() => { const certifications = [...state.profile.certifications]; certifications.splice(i, 1); updateProfile({ certifications }) }} />
              ))}
              <AddBtn onClick={() => { setCertForm({}); setEditIdx(null); setModal('cert') }}>+ Add course / certification</AddBtn>
            </Card>

            {/* Skills */}
            <Card title={`Skills (${state.profile.skills.length})`}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && skillInput.trim()) { if (!state.profile.skills.includes(skillInput.trim())) updateProfile({ skills: [...state.profile.skills, skillInput.trim()] }); setSkillInput('') } }} placeholder="Type a skill and press Enter..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { if (skillInput.trim() && !state.profile.skills.includes(skillInput.trim())) { updateProfile({ skills: [...state.profile.skills, skillInput.trim()] }); setSkillInput('') } }} style={ghostBtnStyle}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {state.profile.skills.map(s => (
                  <span key={s} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 100, padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {s}
                    <button onClick={() => updateProfile({ skills: state.profile.skills.filter(x => x !== s) })} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            </Card>

            {/* Languages */}
            <Card title={`Languages (${state.profile.languages.length})`}>
              {state.profile.languages.map((l, i) => (
                <EntryItem key={l.id} title={l.name} sub={l.level}
                  onEdit={() => { setLangForm(l); setEditIdx(i); setModal('lang') }}
                  onDelete={() => { const languages = [...state.profile.languages]; languages.splice(i, 1); updateProfile({ languages }) }} />
              ))}
              <AddBtn onClick={() => { setLangForm({}); setEditIdx(null); setModal('lang') }}>+ Add language</AddBtn>
            </Card>

            {/* Achievements */}
            <Card title="Achievements, Projects & Extra">
              <Field label="Add awards, open source projects, volunteer work, side projects, anything notable">
                <textarea value={state.profile.achievements} onChange={e => updateProfile({ achievements: e.target.value })} rows={4} placeholder="- Built Cvbuilder.ai or a career tool used by 50+ people&#10;- Won regional hackathon 2023&#10;- Open source contributor: 200+ GitHub stars" style={textareaStyle} />
              </Field>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setScreen('generate')} style={primaryBtnStyle}>Profile saved → Generate CV ⚡</button>
            </div>
          </div>
        )}

        {/* ── GENERATE ── */}
        {screen === 'generate' && (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 }}>Generate CV</h1>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Paste a job link or description — the system reads it and matches your CV to the role.</p>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>What job are you applying to?</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>
                Paste the URL or full job text below. The tool extracts keywords, requirements, and tone — then rebuilds your CV to match with confidence.
              </div>

              {/* URL row */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexDirection: isMobile ? 'column' : 'row' }}>
                <input value={jobUrl} onChange={e => setJobUrl(e.target.value)} placeholder="https://linkedin.com/jobs/... or any job URL" style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
                <button onClick={fetchJob} disabled={fetchingUrl || !jobUrl} style={{ ...primaryBtnStyle, opacity: fetchingUrl || !jobUrl ? 0.5 : 1, width: isMobile ? '100%' : 'auto' }}>
                  {fetchingUrl ? '...' : 'Fetch'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', fontSize: 12, margin: '12px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /> or paste directly <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <Field label="Full job description">
                <textarea value={jobText} onChange={e => setJobText(e.target.value)} rows={9} placeholder="Paste the complete job description here — responsibilities, requirements, nice-to-haves, company info. The more detail provided, the sharper the match." style={textareaStyle} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
                <Field label="Company name"><Input value={jobCompany} onChange={setJobCompany} placeholder="Acme Corp" /></Field>
                <Field label="Role title"><Input value={jobRole} onChange={setJobRole} placeholder="Senior Software Engineer" /></Field>
                <Field label="Language">
                  <select value={outputLanguage} onChange={e => updateOutputLanguage(e.target.value as 'English' | 'Spanish')} style={inputStyle}>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                  </select>
                </Field>
              </div>

              <div style={{ marginTop: 20 }}>
                <button onClick={generate} disabled={generating || !jobText.trim()} style={{ ...primaryBtnStyle, padding: '12px 28px', fontSize: 15, opacity: generating || !jobText.trim() ? 0.5 : 1 }}>
                  {generating ? '⏳ Generating...' : '⚡ Generate tailored CV'}
                </button>
              </div>
            </div>

            {/* Status */}
            {genStatus && genStatus !== 'done' && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', marginBottom: 16, fontSize: 13, color: genStatus.startsWith('Error') ? 'var(--danger)' : 'var(--info)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {!genStatus.startsWith('Error') && <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--info)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
                {genStatus}
              </div>
            )}

            {/* Result */}
            {currentCV && (
              <div className="fade-in">
                {/* Download bar */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: 16, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
                  <div style={{ fontSize: 13 }}>
                    CV tailored for <strong style={{ color: 'var(--accent)' }}>{currentCV.role}</strong> @ <strong style={{ color: 'var(--accent)' }}>{currentCV.company}</strong>
                    <span style={{ marginLeft: 12, background: 'rgba(74,240,160,0.12)', color: 'var(--success)', fontSize: 11, padding: '2px 10px', borderRadius: 100, border: '1px solid rgba(74,240,160,0.2)' }}>ATS Optimized ✓</span>
                    <span style={{ marginLeft: 8, background: 'rgba(95,184,255,0.1)', color: 'var(--info)', fontSize: 11, padding: '2px 10px', borderRadius: 100, border: '1px solid rgba(95,184,255,0.2)' }}>⏱ ~{currentCV.timeSavedMinutes}min saved</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => downloadWord(state.profile, currentCV.cvData, currentCV.role)} style={ghostBtnStyle}>⬇ Word</button>
                    <button onClick={() => downloadPDF(state.profile, currentCV.cvData, currentCV.role, previewRef.current, effectiveTemplateId)} style={primaryBtnStyle}>⬇ PDF</button>
                  </div>
                </div>

                {/* ATS */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 12 }}>ATS Analysis</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                    <span>Keyword match score</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{currentCV.atsScore}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 100, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ height: '100%', width: currentCV.atsScore + '%', background: currentCV.atsScore > 80 ? 'var(--success)' : currentCV.atsScore > 60 ? 'var(--accent)' : 'var(--danger)', borderRadius: 100, transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {currentCV.matchedKeywords.map(kw => (
                      <span key={kw} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 100, background: 'rgba(200,240,74,0.1)', color: 'var(--accent)', border: '1px solid rgba(200,240,74,0.2)' }}>{kw}</span>
                    ))}
                  </div>
                  {tailoringNotes && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(95,184,255,0.06)', border: '1px solid rgba(95,184,255,0.15)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--info)' }}>Tailoring notes:</strong> {tailoringNotes}
                    </div>
                  )}
                </div>

                {/* Template Selector */}
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 22px', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666', marginBottom: 14 }}>📋 CV Template</div>
                  <div style={{ display: 'grid', gridTemplateColumns: responsiveTemplateGrid, gap: 10 }}>
                    {CV_TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => updateTemplateSelection(t.id)} style={{ padding: '12px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: selectedTemplate === t.id ? '#fff' : '#555', background: selectedTemplate === t.id ? '#c8f04a' : '#f3f4f6', border: selectedTemplate === t.id ? '2px solid #b8d63e' : '1px solid #d1d5db', fontWeight: selectedTemplate === t.id ? 600 : 500, transition: 'all 0.15s', textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CV Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                  {(['preview', 'raw'] as const).map(t => (
                    <button key={t} onClick={() => setCvTab(t)} style={{ padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: cvTab === t ? 'var(--text)' : 'var(--muted)', background: cvTab === t ? 'var(--surface2)' : 'none', border: cvTab === t ? '1px solid var(--border)' : '1px solid transparent', fontFamily: 'DM Sans', transition: 'all 0.15s' }}>
                      {t === 'preview' ? 'CV Preview' : 'Plain text'}
                    </button>
                  ))}
                </div>

                {cvTab === 'preview' && <CVPreview profile={state.profile} cvData={currentCV.cvData} templateId={effectiveTemplateId} containerRef={previewRef} isMobile={isMobile} />}
                {cvTab === 'raw' && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text)', fontFamily: 'DM Sans', lineHeight: 1.7 }}>{buildRawText(currentCV)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY ── */}
        {/* ── JOBS ── */}
        {screen === 'jobs' && (() => {
          const pagerBtn = (active: boolean): React.CSSProperties => ({ minWidth: 34, padding: '7px 10px', borderRadius: 8, border: '1px solid ' + (active ? '#4f46e5' : '#cbd5e1'), background: active ? '#4f46e5' : '#fff', color: active ? '#fff' : '#0f172a', fontSize: 12, fontWeight: 600, cursor: 'pointer' })
          const statusBtn = (active: boolean): React.CSSProperties => ({ padding: '9px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (active ? '#4f46e5' : '#dfe4f3'), background: active ? '#eef2ff' : '#fff', color: active ? '#4f46e5' : '#64748b' })
          const statusOf = (j: any) => jobStatusMap[String(j.url || j.title || '')]
          // "all" shows everything EXCEPT jobs you've hidden; the other tabs show
          // exactly that status (saved / applied / hidden).
          let viewed = jobView === 'all' ? jobsList.filter((j: any) => statusOf(j) !== 'hidden') : jobsList.filter((j: any) => statusOf(j) === jobView)
          // In the main view, also drop roles that explicitly require US work
          // authorization (you can't use those from Costa Rica). The toggle lets
          // a US citizen (e.g. Nicole) switch this off.
          const applyFilterOn = searchPrefs.onlyApplyable && jobView === 'all'
          const hiddenUsOnly = applyFilterOn ? viewed.filter((j: any) => j.eligibility === 'us_only').length : 0
          if (applyFilterOn) viewed = viewed.filter((j: any) => j.eligibility !== 'us_only')
          const totalPages = Math.max(1, Math.ceil(viewed.length / JOBS_PER_PAGE))
          const page = Math.min(jobsPage, totalPages)
          const pageJobs = viewed.slice((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE)
          return (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <div>
                <h1 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, margin: 0, color: '#0b3d91' }}>Jobs for you</h1>
                <p style={{ color: '#475569', margin: '6px 0 0', fontSize: 14 }}>
                  {jobsLoading
                    ? 'Searching…'
                    : jobsError
                      ? <span style={{ color: '#ef4444' }}>Error: {jobsError}</span>
                      : <><strong>{viewed.length}</strong> {jobView === 'all' ? 'you can apply to' : jobView} — from <strong>{jobsSources}</strong> sites.{jobView === 'all' && hiddenUsOnly > 0 ? ` ${hiddenUsOnly} US-only tucked away.` : ''} Hit <strong>⭐ Smart match</strong> to rank by fit.</>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={scoreMatches} disabled={matching || !jobsList.length} style={{ ...primaryBtnStyle, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', boxShadow: 'none' }}>{matching ? 'Matching…' : '⭐ Smart match'}</button>
                <button onClick={() => loadJobs()} disabled={jobsLoading} style={primaryBtnStyle}>↻ Refresh</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['all', 'saved', 'applied', 'hidden'] as const).map((v) => (
                <button key={v} onClick={() => { setJobView(v); setJobsPage(1); setExpandedJob(null) }} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', border: '1px solid ' + (jobView === v ? '#4f46e5' : '#dfe4f3'), background: jobView === v ? '#4f46e5' : '#fff', color: jobView === v ? '#fff' : '#475569' }}>{v}</button>
              ))}
              <div style={{ width: 1, height: 20, background: '#dfe4f3', margin: '0 2px' }} />
              <button
                onClick={() => { const next = { ...searchPrefs, onlyApplyable: !searchPrefs.onlyApplyable }; setSearchPrefs(next); setJobsPage(1); try { window.localStorage.setItem('damieli_search_prefs', JSON.stringify(next)) } catch { /* ignore */ } }}
                title="Hide jobs that require US work authorization. Turn off if you can legally work in the US."
                style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (searchPrefs.onlyApplyable ? '#16a34a' : '#dfe4f3'), background: searchPrefs.onlyApplyable ? '#dcfce7' : '#fff', color: searchPrefs.onlyApplyable ? '#15803d' : '#475569' }}
              >🌎 Apply from Costa Rica {searchPrefs.onlyApplyable ? 'ON' : 'OFF'}</button>
              {searchPrefs.onlyApplyable && hiddenUsOnly > 0 && (
                <span style={{ fontSize: 12, color: '#64748b' }}>{hiddenUsOnly} US-only hidden</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pageJobs.map((job: any, i: number) => {
                const idx = (page - 1) * JOBS_PER_PAGE + i
                const open = expandedJob === idx
                return (
                <div key={idx} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 14, background: '#fff' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{job.title}</div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{job.company} · <span style={{ textTransform: 'capitalize' }}>{job.source}</span></div>
                  {typeof job.score === 'number' && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 999, color: '#fff', background: job.score >= 70 ? '#059669' : job.score >= 40 ? '#d97706' : '#dc2626' }}>{job.score}% match</span>
                      {job.reason ? <span style={{ fontSize: 12, color: '#64748b' }}>{job.reason}</span> : null}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {job.eligibility && job.eligibility !== 'unknown' && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: job.eligibility === 'us_only' ? '#dbeafe' : '#dcfce7', color: job.eligibility === 'us_only' ? '#1d4ed8' : '#15803d' }}>{job.eligibility === 'us_only' ? '🇺🇸 US-based (remote OK)' : job.eligibility === 'latam' ? '🌎 LATAM OK' : '🌍 Worldwide'}</span>
                    )}
                    {[job.remoteType, job.location, job.salaryText].filter(Boolean).map((tag: any, k: number) => (
                      <span key={k} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.06)', color: '#334155' }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button onClick={() => { setJobText(job.description || ''); setJobCompany(job.company || ''); setJobRole(job.title || ''); setJobUrl(job.url || ''); setScreen('generate') }} style={primaryBtnStyle}>Create tailored CV →</button>
                    <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ padding: '9px 14px', borderRadius: 10, background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Open &amp; Apply →</a>
                    <button onClick={() => setExpandedJob(open ? null : idx)} style={{ padding: '9px 14px', borderRadius: 10, background: 'transparent', color: '#4f46e5', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{open ? 'Hide details' : 'Details'}</button>
                    <button onClick={() => markJob(job, 'saved')} style={statusBtn(statusOf(job) === 'saved')}>{statusOf(job) === 'saved' ? '★ Saved' : '☆ Save'}</button>
                    <button onClick={() => markJob(job, 'applied')} style={statusBtn(statusOf(job) === 'applied')}>{statusOf(job) === 'applied' ? '✓ Applied' : 'Mark applied'}</button>
                    <button onClick={() => markJob(job, 'hidden')} title="Can't apply to this one? Hide it so it stops showing up." style={{ ...statusBtn(statusOf(job) === 'hidden'), marginLeft: 'auto', color: statusOf(job) === 'hidden' ? '#4f46e5' : '#b91c1c', borderColor: statusOf(job) === 'hidden' ? '#4f46e5' : '#fecaca' }}>{statusOf(job) === 'hidden' ? '↩ Unhide' : "🚫 Can't apply"}</button>
                  </div>
                  {open && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eef2f7', fontSize: 13, color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto' }}>
                      {job.description ? String(job.description).slice(0, 4000) : 'No description provided.'}
                    </div>
                  )}
                </div>
                )
              })}
              {!jobsLoading && !jobsError && jobsList.length === 0 && (
                <p style={{ color: '#64748b' }}>No jobs loaded yet — hit Refresh.</p>
              )}
            </div>

            {viewed.length > JOBS_PER_PAGE && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
                <button onClick={() => { setJobsPage(Math.max(1, page - 1)); setExpandedJob(null) }} disabled={page === 1} style={pagerBtn(false)}>‹ Prev</button>
                {Array.from({ length: totalPages }).map((_, n) => (
                  <button key={n} onClick={() => { setJobsPage(n + 1); setExpandedJob(null) }} style={pagerBtn(page === n + 1)}>{n + 1}</button>
                ))}
                <button onClick={() => { setJobsPage(Math.min(totalPages, page + 1)); setExpandedJob(null) }} disabled={page === totalPages} style={pagerBtn(false)}>Next ›</button>
              </div>
            )}
          </div>
          )
        })()}

        {/* ── SETTINGS ── */}
        {screen === 'settings' && (() => {
          const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700, color: '#334155' }
          const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, color: '#0f172a', background: '#fff' }
          const save = () => {
            try { window.localStorage.setItem('damieli_search_prefs', JSON.stringify(searchPrefs)) } catch { /* ignore */ }
            setScreen('jobs'); loadJobs(searchPrefs)
          }
          return (
          <div style={{ maxWidth: 560 }}>
            <h1 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: '#0f172a' }}>Search settings</h1>
            <p style={{ color: '#475569', margin: '0 0 20px', fontSize: 14 }}>Tell DAMIELI what you want — these drive the Jobs search.</p>
            <div style={{ display: 'grid', gap: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
              <label style={lbl}>Work style
                <select value={searchPrefs.modality} onChange={e => setSearchPrefs({ ...searchPrefs, modality: e.target.value })} style={inp}>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                  <option value="any">Any</option>
                </select>
              </label>
              <label style={lbl}>Seniority
                <select value={searchPrefs.seniority} onChange={e => setSearchPrefs({ ...searchPrefs, seniority: e.target.value })} style={inp}>
                  <option>Junior</option><option>Mid</option><option>Senior</option><option>Lead</option>
                </select>
              </label>
              <label style={lbl}>Minimum salary (USD / year — 0 = any)
                <input type="number" value={searchPrefs.minSalary} onChange={e => setSearchPrefs({ ...searchPrefs, minSalary: Number(e.target.value) || 0 })} style={inp} />
              </label>
              <label style={lbl}>Zone / country (blank = anywhere)
                <input type="text" placeholder="e.g. Costa Rica, LATAM, Brasil, Worldwide" value={searchPrefs.zone} onChange={e => setSearchPrefs({ ...searchPrefs, zone: e.target.value })} style={inp} />
              </label>
              <label style={lbl}>Roles / job titles to search (comma-separated — this is what the sites search for)
                <input type="text" placeholder="e.g. QA tester, developer, IT support, accounting, credit analyst" value={searchPrefs.keywords} onChange={e => setSearchPrefs({ ...searchPrefs, keywords: e.target.value })} style={inp} />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -4, flexWrap: 'wrap' }}>
                <button type="button" onClick={autoPickRoles} disabled={rolesLoading} style={{ ...ghostBtnStyle, padding: '7px 12px', fontSize: 12 }}>{rolesLoading ? 'Picking…' : '✨ Auto-pick roles from my profile'}</button>
                <span style={{ fontSize: 12, color: '#64748b' }}>Don't have a target title? Let DAMIELI choose remote-friendly roles from your profile.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button onClick={save} style={primaryBtnStyle}>Save &amp; search →</button>
              </div>
            </div>
          </div>
          )
        })()}

        {screen === 'history' && (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4, color: '#0b3d91' }}>History</h1>
              <p style={{ color: '#0b3d91', fontSize: 13 }}>All your generated CVs — {state.stats.totalTimeSaved} minutes saved so far</p>
              <p style={{ color: '#0b3d91', fontSize: 12, marginTop: 6 }}>Choose English or Spanish before generating your CV.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 12, color: '#0b3d91' }}>
                <span>{serverHistory.length} records stored on the server</span>
                <button onClick={() => fetchServerState()} style={{ border: '1px solid #0b3d91', background: 'transparent', color: '#0b3d91', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Refresh server history</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: responsiveTwoColGrid, gap: 12, marginBottom: 20 }}>
              <div style={{ padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 12, color: '#0b3d91', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Local history</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0b3d91' }}>{state.history.length}</div>
                <div style={{ fontSize: 12, color: '#0b3d91', marginTop: 6 }}>CVs stored in this browser.</div>
              </div>
              <div style={{ padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 12, color: '#0b3d91', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Server history</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0b3d91' }}>{serverHistory.length}</div>
                <div style={{ fontSize: 12, color: '#0b3d91', marginTop: 6 }}>CVs backed up to your account.</div>
              </div>
            </div>

            {state.history.length === 0 && serverHistory.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>No CVs generated yet. Start with Generate CV to see your first draft here.</div>
            )}

            {state.history.map(h => (
              <div key={h.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: 12, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{h.role} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>@ {h.company}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {h.generatedAt} · ATS: <span style={{ color: 'var(--accent)' }}>{h.atsScore}%</span> · {h.matchedKeywords.slice(0, 3).join(', ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto' }}>
                  <button onClick={() => { setCurrentCV(h); setScreen('generate') }} style={ghostBtnStyle}>View</button>
                  <button onClick={() => downloadPDF(state.profile, h.cvData, h.role, undefined, h.templateId || effectiveTemplateId)} style={primaryBtnStyle}>⬇ PDF</button>
                </div>
              </div>
            ))}

            {serverHistory.length > 0 && (
              <div style={{ marginTop: 24, padding: '18px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18 }}>
                <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--info)', fontWeight: 600 }}>Server-persisted history</div>
                {serverHistory.map(h => (
                  <div key={h.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.role} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>@ {h.company}</span></div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        {h.generatedAt} · ATS: <span style={{ color: 'var(--accent)' }}>{h.atsScore}%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setCurrentCV(h); setScreen('generate') }} style={ghostBtnStyle}>View</button>
                      <button onClick={() => downloadPDF(state.profile, h.cvData, h.role, undefined, h.templateId || effectiveTemplateId)} style={primaryBtnStyle}>⬇ PDF</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── MODALS ── */}
      {authModal && (
        <Modal title={authModal === 'login' ? 'Sign in to DAMIELI' : 'Create your account'} onClose={() => setAuthModal(null)}
          onSave={() => authRequest(authModal)}>
          <div style={{ marginBottom: 18, color: 'var(--muted)', fontSize: 13 }}>
            {authModal === 'login'
              ? 'Enter your email and password to access your saved CV history.'
              : 'Create a secure account to store your profile and generated CVs. If your email already exists, please sign in instead.'}
          </div>
          <Field label="Email">
            <Input value={authEmail} onChange={setAuthEmail} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Password" style={inputStyle} />
          </Field>
          {authStatus && <div style={{ color: 'var(--danger)', marginTop: 10, fontSize: 12 }}>{authStatus}</div>}
          {syncStatus && !authStatus && <div style={{ color: '#2563eb', marginTop: 10, fontSize: 12 }}>{syncStatus}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button onClick={() => setAuthModal(null)} style={ghostBtnStyle}>Cancel</button>
            <button onClick={() => authRequest(authModal)} style={{ ...primaryBtnStyle, opacity: authLoading ? 0.6 : 1 }} disabled={authLoading}>{authLoading ? 'Working…' : authModal === 'login' ? 'Login' : 'Sign up'}</button>
          </div>
        </Modal>
      )}

      {modal === 'job' && (
        <Modal title={editIdx !== null ? 'Edit position' : 'Add work experience'} onClose={() => setModal(null)}
          onSave={() => {
            if (!jobForm.title) return
            const entry: Job = { id: uid(), title: jobForm.title || '', company: jobForm.company || '', start: jobForm.start || '', end: jobForm.end || '', location: jobForm.location || '', description: jobForm.description || '', technologies: jobForm.technologies || '' }
            const jobs = [...state.profile.jobs]
            if (editIdx !== null) jobs[editIdx] = entry; else jobs.unshift(entry)
            updateProfile({ jobs }); setModal(null)
          }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Job title"><Input value={jobForm.title || ''} onChange={v => setJobForm(f => ({ ...f, title: v }))} placeholder="Software Engineer" /></Field>
            <Field label="Company"><Input value={jobForm.company || ''} onChange={v => setJobForm(f => ({ ...f, company: v }))} placeholder="Acme Corp" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Field label="Start"><Input value={jobForm.start || ''} onChange={v => setJobForm(f => ({ ...f, start: v }))} placeholder="Jan 2021" /></Field>
            <Field label="End"><Input value={jobForm.end || ''} onChange={v => setJobForm(f => ({ ...f, end: v }))} placeholder="Present" /></Field>
            <Field label="Location"><Input value={jobForm.location || ''} onChange={v => setJobForm(f => ({ ...f, location: v }))} placeholder="Remote" /></Field>
          </div>
          <Field label="Description & achievements — be specific, include numbers and results">
            <textarea value={jobForm.description || ''} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} rows={5} placeholder="- Led migration from monolith to microservices, reducing deploy time by 60%&#10;- Managed team of 5 engineers&#10;- Built CI/CD pipeline, cut production bugs by 40%" style={textareaStyle} />
          </Field>
          <Field label="Technologies / tools used">
            <Input value={jobForm.technologies || ''} onChange={v => setJobForm(f => ({ ...f, technologies: v }))} placeholder="React, Node.js, PostgreSQL, AWS, Docker" />
          </Field>
        </Modal>
      )}

      {modal === 'edu' && (
        <Modal title={editIdx !== null ? 'Edit education' : 'Add education'} onClose={() => setModal(null)}
          onSave={() => {
            if (!eduForm.degree) return
            const entry: Education = { id: uid(), degree: eduForm.degree || '', school: eduForm.school || '', startYear: eduForm.startYear || '', endYear: eduForm.endYear || '', notes: eduForm.notes || '' }
            const education = [...state.profile.education]
            if (editIdx !== null) education[editIdx] = entry; else education.push(entry)
            updateProfile({ education }); setModal(null)
          }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Degree / qualification"><Input value={eduForm.degree || ''} onChange={v => setEduForm(f => ({ ...f, degree: v }))} placeholder="BSc Computer Science" /></Field>
            <Field label="Institution"><Input value={eduForm.school || ''} onChange={v => setEduForm(f => ({ ...f, school: v }))} placeholder="University of..." /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Start year"><Input value={eduForm.startYear || ''} onChange={v => setEduForm(f => ({ ...f, startYear: v }))} placeholder="2018" /></Field>
            <Field label="End year"><Input value={eduForm.endYear || ''} onChange={v => setEduForm(f => ({ ...f, endYear: v }))} placeholder="2022" /></Field>
          </div>
          <Field label="Honors, GPA, thesis, notable coursework (optional)">
            <textarea value={eduForm.notes || ''} onChange={e => setEduForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="GPA 3.8, Dean's list, Thesis: ..." style={textareaStyle} />
          </Field>
        </Modal>
      )}

      {modal === 'cert' && (
        <Modal title="Add certification / course" onClose={() => setModal(null)}
          onSave={() => {
            if (!certForm.name) return
            const entry: Certification = { id: uid(), name: certForm.name || '', issuer: certForm.issuer || '', date: certForm.date || '', credentialId: certForm.credentialId || '' }
            const certifications = [...state.profile.certifications]
            if (editIdx !== null) certifications[editIdx] = entry; else certifications.push(entry)
            updateProfile({ certifications }); setModal(null)
          }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Certificate name"><Input value={certForm.name || ''} onChange={v => setCertForm(f => ({ ...f, name: v }))} placeholder="AWS Solutions Architect" /></Field>
            <Field label="Issuer / Platform"><Input value={certForm.issuer || ''} onChange={v => setCertForm(f => ({ ...f, issuer: v }))} placeholder="Amazon / Coursera / Udemy" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Date"><Input value={certForm.date || ''} onChange={v => setCertForm(f => ({ ...f, date: v }))} placeholder="2023" /></Field>
            <Field label="Credential ID (optional)"><Input value={certForm.credentialId || ''} onChange={v => setCertForm(f => ({ ...f, credentialId: v }))} placeholder="ABC-1234" /></Field>
          </div>
        </Modal>
      )}

      {modal === 'lang' && (
        <Modal title="Add language" onClose={() => setModal(null)}
          onSave={() => {
            if (!langForm.name) return
            const entry: Language = { id: uid(), name: langForm.name || '', level: langForm.level || 'Fluent' }
            const languages = [...state.profile.languages]
            if (editIdx !== null) languages[editIdx] = entry; else languages.push(entry)
            updateProfile({ languages }); setModal(null)
          }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Language"><Input value={langForm.name || ''} onChange={v => setLangForm(f => ({ ...f, name: v }))} placeholder="Spanish" /></Field>
            <Field label="Level">
              <select value={langForm.level || 'Fluent'} onChange={e => setLangForm(f => ({ ...f, level: e.target.value }))} style={inputStyle}>
                {['Native', 'Fluent', 'Advanced (C1)', 'Upper-Intermediate (B2)', 'Intermediate (B1)', 'Basic (A2)'].map(l => <option key={l}>{l}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────

function CVPreview({ profile, cvData, templateId, containerRef, isMobile }: { profile: UserProfile; cvData: CVData; templateId: string; containerRef?: React.Ref<HTMLDivElement>; isMobile?: boolean }) {
  const contact = [profile.email, profile.phone, profile.location, profile.linkedin, profile.portfolio].filter(Boolean)
  const isModern = templateId === 'modern' || !['ats', 'creative'].includes(templateId)
  const isAts = templateId === 'ats'
  const isCreative = templateId === 'creative'
  const accentColor = isCreative ? '#7dd3fc' : isAts ? '#2563eb' : '#0f766e'
  const containerStyle: React.CSSProperties = {
    background: isCreative ? '#0f172a' : isAts ? '#f8fafc' : '#fff',
    color: isCreative ? '#f8fafc' : '#111',
    borderRadius: 16,
    padding: isCreative ? '34px 32px' : '40px 44px',
    fontFamily: isAts ? 'Inter, sans-serif' : isCreative ? 'Montserrat, sans-serif' : 'Georgia, serif',
    lineHeight: 1.6,
    maxWidth: isMobile ? '100%' : 780,
    width: '100%',
    margin: '0 auto',
    fontSize: 14,
    overflow: 'hidden',
    boxShadow: isCreative ? '0 0 0 1px rgba(255,255,255,0.08)' : '0 0 0 1px rgba(0,0,0,0.06)',
    border: isCreative ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.06)',
  }
  const headingStyle: React.CSSProperties = {
    fontFamily: 'Syne, sans-serif',
    fontSize: isAts ? 24 : 26,
    fontWeight: 800,
    color: isCreative ? '#7dd3fc' : accentColor,
    marginBottom: 4,
    letterSpacing: -0.5,
  }
  const sectionHeadingProps = {
    titleStyle: {
      color: isCreative ? '#bae6fd' : isAts ? '#0f172a' : accentColor,
      borderColor: isCreative ? 'rgba(125, 211, 252, 0.3)' : isAts ? '#cbd5e1' : '#d1fae5',
      background: isModern ? 'linear-gradient(90deg, rgba(15,118,110,0.08), transparent)' : isCreative ? 'rgba(255,255,255,0.04)' : 'transparent',
      padding: isModern || isCreative ? '6px 8px' : '0 0 5px',
      borderRadius: isModern || isCreative ? 6 : undefined,
      borderLeft: isCreative ? '2px solid #7dd3fc' : undefined,
      marginBottom: 10,
    },
    itemStyle: {
      color: isCreative ? '#e2e8f0' : '#333',
      background: isAts ? '#fff' : 'transparent',
    },
  }

  const bodyContent = (
    <div>
      {isModern && <div style={{ height: 4, background: 'linear-gradient(90deg, #0f766e 0%, #34d399 100%)', borderRadius: 999, marginBottom: 16 }} />}
      <div style={headingStyle}>{profile.name}</div>
      {profile.headline && <div style={{ fontSize: 13, color: isCreative ? '#cbd5e1' : '#444', marginBottom: 6, fontStyle: 'italic' }}>{profile.headline}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 14px', fontSize: 12, color: isCreative ? '#cbd5e1' : '#555', marginBottom: isCreative ? 16 : 22 }}>
        {contact.map(c => <span key={c}>{c}</span>)}
      </div>
      {cvData.summary && <CVSection title="Professional Summary" styleOverride={sectionHeadingProps}>{<p style={{ fontSize: 13, color: sectionHeadingProps.itemStyle.color, lineHeight: 1.75, margin: 0 }}>{cvData.summary}</p>}</CVSection>}
      {cvData.experience?.length > 0 && (
        <CVSection title="Experience" styleOverride={sectionHeadingProps}>
          {cvData.experience.map((exp, i) => (
            <div key={i} style={{ marginBottom: isAts ? 14 : 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <strong style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, color: isCreative ? '#f8fafc' : '#111' }}>{exp.title}</strong>
                <span style={{ fontSize: 12, color: isCreative ? '#99a3b5' : '#777' }}>{exp.dates}</span>
              </div>
              <div style={{ fontSize: 13, color: isCreative ? '#cbd5e1' : '#444', fontStyle: 'italic', marginBottom: 6 }}>{exp.company}{exp.location ? ` — ${exp.location}` : ''}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {exp.bullets?.map((b, j) => <li key={j} style={{ fontSize: 13, color: sectionHeadingProps.itemStyle.color, marginBottom: 3 }}>{b}</li>)}
              </ul>
            </div>
          ))}
        </CVSection>
      )}
      {cvData.education?.length > 0 && (
        <CVSection title="Education" styleOverride={sectionHeadingProps}>
          {cvData.education.map((e, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, color: isCreative ? '#f8fafc' : '#111' }}>{e.degree}</strong>
                <span style={{ fontSize: 12, color: isCreative ? '#99a3b5' : '#777' }}>{e.year}</span>
              </div>
              <div style={{ fontSize: 13, color: isCreative ? '#cbd5e1' : '#444', fontStyle: 'italic' }}>{e.school}</div>
              {e.note && <div style={{ fontSize: 12, color: sectionHeadingProps.itemStyle.color, marginTop: 3 }}>{e.note}</div>}
            </div>
          ))}
        </CVSection>
      )}
      {cvData.skills?.length > 0 && (
        <CVSection title="Skills" styleOverride={sectionHeadingProps}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cvData.skills.map(s => <span key={s} style={{ background: isCreative ? '#1e293b' : '#f3f3f3', borderRadius: 4, padding: '3px 10px', fontSize: 12, color: sectionHeadingProps.itemStyle.color }}>{s}</span>)}
          </div>
        </CVSection>
      )}
      {cvData.certifications?.length > 0 && (
        <CVSection title="Certifications" styleOverride={sectionHeadingProps}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{cvData.certifications.map((c, i) => <li key={i} style={{ fontSize: 13, color: sectionHeadingProps.itemStyle.color, marginBottom: 3 }}>{c}</li>)}</ul>
        </CVSection>
      )}
      {cvData.languages?.length > 0 && (
        <CVSection title="Languages" styleOverride={sectionHeadingProps}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cvData.languages.map(l => <span key={l} style={{ background: isCreative ? '#1e293b' : '#f3f3f3', borderRadius: 4, padding: '3px 10px', fontSize: 12, color: sectionHeadingProps.itemStyle.color }}>{l}</span>)}
          </div>
        </CVSection>
      )}
    </div>
  )

  return (
    <div ref={containerRef} style={containerStyle}>
      {isCreative ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '220px 1fr', gap: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 18, alignSelf: 'start' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#7dd3fc', marginBottom: 8 }}>{profile.name}</div>
            {profile.headline && <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 12, lineHeight: 1.5 }}>{profile.headline}</div>}
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color: '#bae6fd', marginBottom: 8 }}>Contact</div>
            <div style={{ display: 'grid', gap: 4, fontSize: 12, color: '#e2e8f0' }}>
              {contact.map(c => <span key={c}>{c}</span>)}
            </div>
            {cvData.skills?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color: '#bae6fd', marginBottom: 8 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cvData.skills.map(s => <span key={s} style={{ background: '#1e293b', borderRadius: 999, padding: '4px 8px', fontSize: 11, color: '#e2e8f0' }}>{s}</span>)}
                </div>
              </div>
            )}
          </div>
          <div>{bodyContent}</div>
        </div>
      ) : (
        bodyContent
      )}
    </div>
  )
}

function CVSection({ title, children, styleOverride }: { title: string; children: React.ReactNode; styleOverride?: { titleStyle?: React.CSSProperties; itemStyle?: React.CSSProperties } }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#666', borderBottom: '1.5px solid #e0e0e0', paddingBottom: 5, marginBottom: 12, ...(styleOverride?.titleStyle || {}) }}>{title}</div>
      {children}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 14 }}>
      <div style={{ fontFamily: 'Syne', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5, fontWeight: 500 }}>{label}</label>{children}</div>
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
}

function EntryItem({ title, sub, onEdit, onDelete }: { title: string; sub: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div><div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div></div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onEdit} style={ghostBtnStyle}>Edit</button>
        <button onClick={onDelete} style={{ ...ghostBtnStyle, color: 'var(--danger)', borderColor: 'rgba(255,95,95,0.2)' }}>Delete</button>
      </div>
    </div>
  )
}

function AddBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '100%', padding: '10px', background: 'var(--surface2)', border: '1px dashed var(--border2)', borderRadius: 10, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13, transition: 'all 0.15s', marginTop: 4 }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)' }}>
      {children}
    </button>
  )
}

function Modal({ title, children, onClose, onSave }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
          <button onClick={onSave} style={primaryBtnStyle}>Save</button>
        </div>
      </div>
    </div>
  )
}

// ─── Style constants ───────────────────────────────────────────────
const inputStyle: React.CSSProperties = { width: '100%', background: '#ffffff', border: '1px solid #dfe4f3', borderRadius: 10, padding: '11px 14px', color: '#0e1430', fontFamily: 'DM Sans', fontSize: 13, outline: 'none' }
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 120 }
const primaryBtnStyle: React.CSSProperties = { padding: '11px 18px', borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 700, boxShadow: '0 10px 26px rgba(79,70,229,0.30)' }
const ghostBtnStyle: React.CSSProperties = { padding: '9px 14px', borderRadius: 10, background: '#ffffff', color: '#4f46e5', border: '1px solid #dfe4f3', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600 }
