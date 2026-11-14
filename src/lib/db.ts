// Storage layer — Supabase (Postgres). Replaces the old throwaway SQLite file
// so users / profiles / history persist and sync across every device.
//
// Same exported functions and return shapes as before, so auth and the API
// routes keep working untouched. Server-only: uses the secret/service key,
// which never reaches the browser.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  createdAt: string
}

let _client: SupabaseClient | null = null
function db(): SupabaseClient {
  if (_client) return _client
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ''
  if (!url || !key) {
    throw new Error('Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  }
  _client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return _client
}

const normEmail = (e: string) => String(e || '').trim().toLowerCase()

// Cheapest possible query that still counts as database activity, so the
// daily cron ping keeps the free-tier Supabase project from auto-pausing.
export async function pingDb(): Promise<boolean> {
  const { error } = await db().from('users').select('id', { count: 'exact', head: true }).limit(1)
  if (error) { console.error('pingDb error', error); return false }
  return true
}

export async function createUser(user: UserRecord) {
  const email = normEmail(user.email)
  const { data: existing, error: findErr } = await db().from('users').select('id').eq('email', email).limit(1)
  if (findErr) { console.error('createUser lookup error', findErr); throw new Error(findErr.message) }
  if (existing && existing.length) throw new Error('Email already in use')
  const { error } = await db().from('users').insert({
    id: user.id, email, passwordHash: user.passwordHash, createdAt: user.createdAt,
  })
  if (error) { console.error('createUser error', error); throw new Error(error.message) }
}

export async function findUsersByEmail(email: string): Promise<UserRecord[]> {
  try {
    const { data, error } = await db().from('users').select('*').eq('email', normEmail(email))
    if (error) { console.error('findUsersByEmail error', error); return [] }
    return (data || []) as UserRecord[]
  } catch (e) {
    console.error('findUsersByEmail error', e)
    return []
  }
}

export async function findUserByEmail(email: string) {
  const users = await findUsersByEmail(email)
  return users.length ? users[0] : null
}

export async function findUserById(id: string) {
  try {
    const { data, error } = await db().from('users').select('*').eq('id', id).limit(1)
    if (error) { console.error('findUserById error', error); return null }
    return data && data.length ? (data[0] as UserRecord) : null
  } catch (e) {
    console.error('findUserById error', e)
    return null
  }
}

export async function saveGeneratedCV(cv: any, userId: string) {
  try {
    const { error } = await db().from('history').upsert({
      id: cv.id,
      userId,
      role: cv.role || '',
      company: cv.company || '',
      jobUrl: cv.jobUrl || '',
      generatedAt: cv.generatedAt || '',
      atsScore: cv.atsScore || 0,
      matchedKeywords: cv.matchedKeywords || [],
      timeSavedMinutes: cv.timeSavedMinutes || 0,
      cvData: cv.cvData || {},
    }, { onConflict: 'id' })
    if (error) console.error('saveGeneratedCV error', error)
  } catch (e) {
    console.error('saveGeneratedCV error', e)
  }
}

export async function saveAppState(
  userId: string,
  state: { profile: any; stats: any; history?: any[]; templateId?: string; outputLanguage?: string },
) {
  try {
    const fullState = {
      profile: state.profile || {},
      stats: state.stats || {},
      history: state.history || [],
      templateId: state.templateId || 'modern',
      outputLanguage: state.outputLanguage || 'English',
    }
    // The whole state blob lives in `profile` (matches getAppState's contract).
    const { error } = await db().from('app_state').upsert({
      userId,
      profile: fullState,
      stats: state.stats || {},
      templateId: fullState.templateId,
      outputLanguage: fullState.outputLanguage,
    }, { onConflict: 'userId' })
    if (error) console.error('saveAppState error', error)
  } catch (e) {
    console.error('saveAppState error', e)
  }
}

export async function getAppState(userId: string) {
  try {
    const { data, error } = await db().from('app_state').select('*').eq('userId', userId).limit(1)
    if (error) { console.error('getAppState error', error); return null }
    if (!data || !data.length) return null
    const row: any = data[0]
    const parsed = row.profile // jsonb → already an object
    if (parsed && typeof parsed === 'object' && 'profile' in parsed) return parsed
    return {
      profile: parsed || {},
      stats: row.stats || {},
      history: [],
      templateId: row.templateId || 'modern',
      outputLanguage: row.outputLanguage || 'English',
    }
  } catch (e) {
    console.error('getAppState error', e)
    return null
  }
}

// ── Accumulating job pool ─────────────────────────────────────────────
// Boards only show their newest ~100 postings, so a live fetch is a snapshot.
// Every fetched job is also upserted here (keyed by URL); searches then merge
// the recent pool back in — the pool GROWS day by day instead of resetting.
// Table (create once in Supabase SQL editor — see supabase/job_pool.sql):
//   job_pool(url text primary key, source text, title text, company text,
//            description text, location text, "remoteType" text, eligibility text,
//            "salaryText" text, "postedAt" text, "firstSeen" timestamptz, "lastSeen" timestamptz)
export type PoolJob = {
  url: string; source: string; title: string; company: string; description: string
  location: string; remoteType: string; eligibility: string; salaryText: string | null; postedAt: string | null
}

export async function upsertJobPool(jobs: PoolJob[]): Promise<void> {
  if (!jobs.length) return
  try {
    const now = new Date().toISOString()
    const rows = jobs.map((j) => ({
      url: j.url, source: j.source, title: j.title, company: j.company,
      description: (j.description || '').slice(0, 4000), location: j.location || '',
      remoteType: j.remoteType || 'unknown', eligibility: j.eligibility || 'unknown',
      salaryText: j.salaryText || null, postedAt: j.postedAt || null, lastSeen: now,
    }))
    // onConflict updates lastSeen (and freshened fields); firstSeen keeps its
    // default from the first insert.
    const { error } = await db().from('job_pool').upsert(rows, { onConflict: 'url' })
    if (error) console.error('upsertJobPool error (table missing? run supabase/job_pool.sql)', error.message)
  } catch (e) {
    console.error('upsertJobPool error', e)
  }
}

export async function getPoolJobs(maxAgeDays = 30, limit = 1500): Promise<PoolJob[]> {
  try {
    const cutoff = new Date(Date.now() - maxAgeDays * 864e5).toISOString()
    const { data, error } = await db().from('job_pool').select('*').gte('lastSeen', cutoff).order('lastSeen', { ascending: false }).limit(limit)
    if (error) { console.error('getPoolJobs error (table missing? run supabase/job_pool.sql)', error.message); return [] }
    return (data || []) as PoolJob[]
  } catch (e) {
    console.error('getPoolJobs error', e)
    return []
  }
}

export async function prunePoolJobs(maxAgeDays = 30): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - maxAgeDays * 864e5).toISOString()
    const { error } = await db().from('job_pool').delete().lt('lastSeen', cutoff)
    if (error) console.error('prunePoolJobs error', error.message)
  } catch (e) {
    console.error('prunePoolJobs error', e)
  }
}

// ── Admin (owner-only) aggregates — used by /api/admin/stats. ─────────
// Never select passwordHash here: these rows travel to the browser.
export async function adminListUsers(): Promise<Array<{ id: string; email: string; createdAt: string }>> {
  const { data, error } = await db().from('users').select('id,email,createdAt').order('createdAt', { ascending: false })
  if (error) { console.error('adminListUsers error', error); return [] }
  return data || []
}

export async function adminListStates(): Promise<Array<{ userId: string; profile: unknown; stats: unknown }>> {
  const { data, error } = await db().from('app_state').select('userId,profile,stats')
  if (error) { console.error('adminListStates error', error); return [] }
  return data || []
}

export async function adminListHistory(): Promise<Array<{ id: string; userId: string; role: string; company: string; generatedAt: string; atsScore: number }>> {
  const { data, error } = await db().from('history').select('id,userId,role,company,generatedAt,atsScore').order('generatedAt', { ascending: false }).limit(100)
  if (error) { console.error('adminListHistory error', error); return [] }
  return data || []
}

export async function getHistory(userId: string) {
  try {
    const { data, error } = await db().from('history').select('*').eq('userId', userId).order('generatedAt', { ascending: false })
    if (error) { console.error('getHistory error', error); return [] }
    return (data || []).map((item: any) => ({
      ...item,
      matchedKeywords: Array.isArray(item.matchedKeywords) ? item.matchedKeywords : (item.matchedKeywords || []),
      cvData: item.cvData || {},
    }))
  } catch (e) {
    console.error('getHistory error', e)
    return []
  }
}
