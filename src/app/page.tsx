'use client'
import { useState, useEffect, useRef } from 'react'
import { AppState, UserProfile, Job, Education, Certification, Language, GeneratedCV, CVData } from '@/lib/types'
import { loadState, saveState, calcProfileStrength, buildProfileText, uid, defaultProfile, defaultState } from '@/lib/state'
import { renderCV } from '@/lib/templates'
import { resolveTemplateId } from '@/lib/export'
import { HomeTab } from '@/components/HomeTab'
import { HistoryTab } from '@/components/HistoryTab'
import { SettingsTab } from '@/components/SettingsTab'
import { JobsTab } from '@/components/JobsTab'
import { GenerateTab } from '@/components/GenerateTab'
import { ProfileTab } from '@/components/ProfileTab'
import { ProfileModals } from '@/components/ProfileModals'
import { AuthModal } from '@/components/AuthModal'
import { Sidebar } from '@/components/Sidebar'


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
  const previewRef = useRef<HTMLDivElement | null>(null)
  const stateRef = useRef<AppState>(state)
  const currentUserRef = useRef<{ id: string; email: string } | null>(currentUser)

  // Form state for modals
  const [jobForm, setJobForm] = useState<Partial<Job>>({})
  const [eduForm, setEduForm] = useState<Partial<Education>>({})
  const [certForm, setCertForm] = useState<Partial<Certification>>({})
  const [langForm, setLangForm] = useState<Partial<Language>>({})

  const openModal = (kind: 'job' | 'edu' | 'cert' | 'lang', form: object, idx: number | null) => {
    if (kind === 'job') setJobForm(form)
    else if (kind === 'edu') setEduForm(form)
    else if (kind === 'cert') setCertForm(form)
    else setLangForm(form)
    setEditIdx(idx)
    setModal(kind)
  }

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
      <Sidebar isMobile={isMobile} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} screen={screen} onNav={(s) => { setScreen(s); if (s === 'jobs' && jobsList.length === 0) loadJobs(); if (isMobile) setSidebarOpen(false) }} currentUser={currentUser} logout={logout} setAuthModal={setAuthModal} syncStatus={syncStatus} stats={state.stats} />

      {/* Main */}
      <main style={{ marginLeft: isMobile ? 0 : 240, flex: 1, padding: isMobile ? '20px 16px 32px' : '32px 40px', maxWidth: 1040, width: '100%', overflowX: 'hidden', paddingTop: isMobile ? 18 : '32px' }}>

        {/* ── HOME ── */}
        {screen === 'home' && (
          <HomeTab stats={state.stats} profile={state.profile} strength={strength} isMobile={isMobile} outputLanguage={outputLanguage} updateOutputLanguage={updateOutputLanguage} setScreen={setScreen} />
        )}

        {/* ── PROFILE ── */}
        {screen === 'profile' && (
          <ProfileTab profile={state.profile} updateProfile={updateProfile} skillInput={skillInput} setSkillInput={setSkillInput} openModal={openModal} onCVUpload={handleCVUpload} setScreen={setScreen} isMobile={isMobile} />
        )}

        {/* ── GENERATE ── */}
        {screen === 'generate' && (
          <GenerateTab profile={state.profile} jobUrl={jobUrl} setJobUrl={setJobUrl} jobText={jobText} setJobText={setJobText} jobCompany={jobCompany} setJobCompany={setJobCompany} jobRole={jobRole} setJobRole={setJobRole} fetchingUrl={fetchingUrl} fetchJob={fetchJob} generate={generate} generating={generating} genStatus={genStatus} currentCV={currentCV} outputLanguage={outputLanguage} updateOutputLanguage={updateOutputLanguage} selectedTemplate={selectedTemplate} updateTemplateSelection={updateTemplateSelection} cvTab={cvTab} setCvTab={setCvTab} tailoringNotes={tailoringNotes} effectiveTemplateId={effectiveTemplateId} previewRef={previewRef} buildRawText={buildRawText} isMobile={isMobile} />
        )}

        {/* ── HISTORY ── */}
        {/* ── JOBS ── */}
        {screen === 'jobs' && (
          <JobsTab jobsList={jobsList} jobsLoading={jobsLoading} jobsError={jobsError} jobsSources={jobsSources} matching={matching} jobsPage={jobsPage} setJobsPage={setJobsPage} expandedJob={expandedJob} setExpandedJob={setExpandedJob} jobView={jobView} setJobView={setJobView} jobStatusMap={jobStatusMap} markJob={markJob} searchPrefs={searchPrefs} setSearchPrefs={setSearchPrefs} loadJobs={() => loadJobs()} scoreMatches={scoreMatches} exportApplyList={exportApplyList} onCreateCV={(job) => { setJobText(job.description || ''); setJobCompany(job.company || ''); setJobRole(job.title || ''); setJobUrl(job.url || ''); setScreen('generate') }} />
        )}

        {/* ── SETTINGS ── */}
        {screen === 'settings' && (
          <SettingsTab searchPrefs={searchPrefs} setSearchPrefs={setSearchPrefs} autoPickRoles={autoPickRoles} rolesLoading={rolesLoading} onSave={() => { try { window.localStorage.setItem('damieli_search_prefs', JSON.stringify(searchPrefs)) } catch { /* ignore */ } setScreen('jobs'); loadJobs(searchPrefs) }} />
        )}

        {screen === 'history' && (
          <HistoryTab history={state.history} stats={state.stats} profile={state.profile} serverHistory={serverHistory} isMobile={isMobile} effectiveTemplateId={effectiveTemplateId} onView={(h) => { setCurrentCV(h); setScreen('generate') }} onRefreshServer={() => fetchServerState()} />
        )}
      </main>

      {/* ── MODALS ── */}
      <AuthModal authModal={authModal} setAuthModal={setAuthModal} authEmail={authEmail} setAuthEmail={setAuthEmail} authPassword={authPassword} setAuthPassword={setAuthPassword} authStatus={authStatus} syncStatus={syncStatus} authLoading={authLoading} authRequest={authRequest} />

      <ProfileModals modal={modal} setModal={setModal} editIdx={editIdx} profile={state.profile} updateProfile={updateProfile} jobForm={jobForm} setJobForm={setJobForm} eduForm={eduForm} setEduForm={setEduForm} certForm={certForm} setCertForm={setCertForm} langForm={langForm} setLangForm={setLangForm} />
    </div>
  )
}
