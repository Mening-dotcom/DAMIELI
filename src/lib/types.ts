export interface Job {
  id: string
  title: string
  company: string
  start: string
  end: string
  location: string
  description: string
  technologies: string
}

export interface Education {
  id: string
  degree: string
  school: string
  startYear: string
  endYear: string
  notes: string
}

export interface Certification {
  id: string
  name: string
  issuer: string
  date: string
  credentialId: string
}

export interface Language {
  id: string
  name: string
  level: string
}

export interface UserProfile {
  name: string
  headline: string
  email: string
  phone: string
  location: string
  linkedin: string
  portfolio: string
  summary: string
  achievements: string
  jobs: Job[]
  education: Education[]
  certifications: Certification[]
  languages: Language[]
  skills: string[]
  uploadedCVText: string
}

export interface GeneratedCV {
  id: string
  role: string
  company: string
  jobUrl: string
  generatedAt: string
  atsScore: number
  matchedKeywords: string[]
  timeSavedMinutes: number
  cvData: CVData
  templateId?: string
}

export interface CVData {
  summary: string
  experience: CVExperience[]
  education: CVEducation[]
  skills: string[]
  certifications: string[]
  languages: string[]
}

export interface CVExperience {
  title: string
  company: string
  dates: string
  location?: string
  bullets: string[]
}

export interface CVEducation {
  degree: string
  school: string
  year: string
  note?: string
}

export interface AppState {
  profile: UserProfile
  history: GeneratedCV[]
  stats: {
    cvsGenerated: number
    jobsAnalyzed: number
    totalTimeSaved: number
  }
  templateId?: string
  outputLanguage?: 'English' | 'Spanish'
}
