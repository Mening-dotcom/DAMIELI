// Shared shape every job source normalizes to, so the UI treats all sources
// the same regardless of where the job came from.

export type RemoteType = 'remote' | 'hybrid' | 'onsite' | 'unknown'

// Can someone based in LATAM (e.g. Costa Rica) actually apply?
export type Eligibility = 'worldwide' | 'latam' | 'us_only' | 'unknown'

export type NormalizedJob = {
  source: string // 'mentorhood' | 'remotive' | ...
  title: string
  company: string
  description: string // plain text
  remoteType: RemoteType
  eligibility?: Eligibility
  location: string
  salaryText: string | null // free-form, e.g. "USD 11,000" or "$50k–$70k"
  postedAt: string | null // ISO date
  url: string // the REAL apply / job-detail link
}
