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
