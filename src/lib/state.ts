import { AppState, UserProfile } from './types'

const KEY = 'damieli_v1'

export const defaultProfile: UserProfile = {
  name: 'Steven',
  headline: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  portfolio: '',
  summary: '',
  achievements: '',
  jobs: [],
  education: [],
  certifications: [],
  languages: [],
  skills: [],
  uploadedCVText: '',
}

export const defaultState: AppState = {
  profile: defaultProfile,
  history: [],
  stats: { cvsGenerated: 0, jobsAnalyzed: 0, totalTimeSaved: 0 },
  templateId: 'modern',
  outputLanguage: 'English',
}

export function loadState(): AppState {
  if (typeof window === 'undefined') return defaultState
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw)
    return {
      ...defaultState,
      ...parsed,
      profile: { ...defaultProfile, ...parsed.profile },
      outputLanguage: parsed.outputLanguage === 'Spanish' ? 'Spanish' : 'English',
    }
  } catch {
    return defaultState
  }
}

export function saveState(state: AppState): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}

export function calcProfileStrength(profile: UserProfile): number {
  let score = 0
  if (profile.name && profile.email) score += 20
  if (profile.jobs.length > 0) score += 25
  if (profile.education.length > 0) score += 15
  if (profile.skills.length >= 5) score += 15
  if (profile.languages.length > 0) score += 10
  if (profile.summary.length > 50) score += 15
  return score
}

export function buildProfileText(profile: UserProfile): string {
  let s = `Name: ${profile.name}\n`
  if (profile.headline) s += `Title: ${profile.headline}\n`
  if (profile.email) s += `Email: ${profile.email}\n`
  if (profile.phone) s += `Phone: ${profile.phone}\n`
  if (profile.location) s += `Location: ${profile.location}\n`
  if (profile.linkedin) s += `LinkedIn: ${profile.linkedin}\n`
  if (profile.portfolio) s += `Portfolio: ${profile.portfolio}\n`
  if (profile.summary) s += `\nProfessional Summary:\n${profile.summary}\n`

  if (profile.jobs.length > 0) {
    s += `\n--- WORK EXPERIENCE ---\n`
    profile.jobs.forEach(j => {
      s += `\n${j.title} at ${j.company} | ${j.start} – ${j.end || 'Present'}`
      if (j.location) s += ` | ${j.location}`
      s += `\n`
      if (j.description) s += `${j.description}\n`
      if (j.technologies) s += `Technologies: ${j.technologies}\n`
    })
  }

  if (profile.education.length > 0) {
    s += `\n--- EDUCATION ---\n`
    profile.education.forEach(e => {
      s += `${e.degree} — ${e.school} (${e.startYear}–${e.endYear})\n`
      if (e.notes) s += `${e.notes}\n`
    })
  }

  if (profile.skills.length > 0) s += `\n--- SKILLS ---\n${profile.skills.join(', ')}\n`

  if (profile.certifications.length > 0) {
    s += `\n--- CERTIFICATIONS ---\n`
    profile.certifications.forEach(c => {
      s += `${c.name} — ${c.issuer}${c.date ? ', ' + c.date : ''}\n`
    })
  }

  if (profile.languages.length > 0) {
    s += `\n--- LANGUAGES ---\n`
    s += profile.languages.map(l => `${l.name} (${l.level})`).join(', ') + '\n'
  }

  if (profile.achievements) s += `\n--- ACHIEVEMENTS & PROJECTS ---\n${profile.achievements}\n`

  if (profile.uploadedCVText) s += `\n--- UPLOADED CV (additional context) ---\n${profile.uploadedCVText}\n`

  return s
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
