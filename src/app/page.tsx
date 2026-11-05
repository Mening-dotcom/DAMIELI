'use client'
import { useState, useEffect, useRef } from 'react'
import { AppState, UserProfile, Job, Education, Certification, Language, GeneratedCV, CVData } from '@/lib/types'
import { loadState, saveState, calcProfileStrength, buildProfileText, uid, defaultProfile, defaultState } from '@/lib/state'
import { CV_TEMPLATES, renderCV } from '@/lib/templates'
import { ScoreBadge, EligibilityBadge } from '@/components/JobBadges'
import { resolveTemplateId, downloadPDF, downloadWord } from '@/lib/export'
import { CVPreview } from '@/components/CVPreview'
import { Card, Field, Input, EntryItem, AddBtn, Modal, inputStyle, textareaStyle, primaryBtnStyle, ghostBtnStyle } from '@/components/ui'
import { HomeTab } from '@/components/HomeTab'
import { HistoryTab } from '@/components/HistoryTab'
import { SettingsTab } from '@/components/SettingsTab'


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
  // Export the Saved jobs as a jobs.json for the local Apply Assistant.
  function exportApplyList() {
    const saved = jobsList.filter((j: any) => jobStatusMap[String(j.url || j.title || '')] === 'saved')
    const list = (saved.length ? saved : jobsList).map((j: any) => ({ title: j.title, url: j.url }))
    if (!list.length) return
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'jobs.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
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
      const rank: Record<string, number> = { latam: 0, worldwide: 1, unknown: 2, us_only: 3, restricted: 4 }
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
      // Score EVERY job, not just the first 30: the API handles 30 per call, so
      // we batch the whole list into parallel chunks and merge the results.
      const CHUNK = 30
      const chunks: any[][] = []
      for (let ci = 0; ci < jobsList.length && chunks.length < 10; ci += CHUNK) chunks.push(jobsList.slice(ci, ci + CHUNK))
      const chunkResults = await Promise.all(chunks.map(async (chunk, ci) => {
        try {
          const res = await fetch('/api/match', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileText, jobs: chunk.map((j: any) => ({ title: j.title, company: j.company, description: j.description, location: j.location })) }),
          })
          const d = await res.json()
          if (d.success && Array.isArray(d.scores)) return d.scores.map((s: any) => ({ ...s, i: Number(s.i) + ci * CHUNK }))
        } catch { /* skip failed chunk */ }
        return []
      }))
      const allScores = chunkResults.reduce((acc: any[], r: any[]) => acc.concat(r), [])
      const data = { success: allScores.length > 0, scores: allScores, error: allScores.length ? '' : 'Matching failed' }
      if (data.success && Array.isArray(data.scores)) {
        const byIdx = new Map<number, any>(data.scores.map((s: any) => [Number(s.i), s] as [number, any]))
        const scored = jobsList.map((j: any, i: number) => {
          const s = byIdx.get(i)
          const elig = s && s.eligible ? String(s.eligible).toLowerCase() : undefined
          return { ...j, score: s && typeof s.score === 'number' ? s.score : null, reason: s && s.reason ? String(s.reason) : '', aiEligible: elig, aiEligReason: s && s.eligReason ? String(s.eligReason) : '' }
        })
        const erank = (e: any) => (e === 'no' ? 1 : 0) // push "can't apply" to the bottom
        scored.sort((a: any, b: any) => erank(a.aiEligible) - erank(b.aiEligible) || ((b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score)))
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
    // v2: role auto-pick now mines ALL profile domains (medical/finance/collections/
    // tech/languages) — bumping the key forces one fresh re-pick for everyone.
    try { already = window.localStorage.getItem('damieli_roles_auto_v2') === '1' } catch { /* ignore */ }
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
      try { window.localStorage.setItem('damieli_roles_auto_v2', '1') } catch { /* ignore */ }
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
          <HomeTab stats={state.stats} profile={state.profile} strength={strength} isMobile={isMobile} outputLanguage={outputLanguage} updateOutputLanguage={updateOutputLanguage} setScreen={setScreen} />
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
          // In the main view, drop roles you can't apply to from Costa Rica.
          // After Smart match we use the AI's real verdict (aiEligible === 'no');
          // before that we fall back to the weak keyword guess. Toggle off for a
          // US citizen (e.g. Nicole).
          const applyFilterOn = searchPrefs.onlyApplyable && jobView === 'all'
          const notApplyable = (j: any) => (j.aiEligible ? j.aiEligible === 'no' : j.eligibility === 'us_only' || j.eligibility === 'restricted')
          const hiddenUsOnly = applyFilterOn ? viewed.filter(notApplyable).length : 0
          if (applyFilterOn) viewed = viewed.filter((j: any) => !notApplyable(j))
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
                <button onClick={exportApplyList} disabled={!jobsList.length} title="Download your Saved jobs as jobs.json for the Apply Assistant" style={{ ...primaryBtnStyle, background: '#fff', color: '#4f46e5', border: '1px solid #c7d2fe', boxShadow: 'none' }}>⤓ Export apply list</button>
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
                  {typeof job.score === 'number' && <ScoreBadge score={job.score} reason={job.reason} />}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <EligibilityBadge aiEligible={job.aiEligible} aiEligReason={job.aiEligReason} eligibility={job.eligibility} />
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
        {screen === 'settings' && (
          <SettingsTab searchPrefs={searchPrefs} setSearchPrefs={setSearchPrefs} autoPickRoles={autoPickRoles} rolesLoading={rolesLoading} onSave={() => { try { window.localStorage.setItem('damieli_search_prefs', JSON.stringify(searchPrefs)) } catch { /* ignore */ } setScreen('jobs'); loadJobs(searchPrefs) }} />
        )}

        {screen === 'history' && (
          <HistoryTab history={state.history} stats={state.stats} profile={state.profile} serverHistory={serverHistory} isMobile={isMobile} effectiveTemplateId={effectiveTemplateId} onView={(h) => { setCurrentCV(h); setScreen('generate') }} onRefreshServer={() => fetchServerState()} />
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
