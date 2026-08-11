import fs from 'fs'
import path from 'path'
import initSqlJs from 'sql.js'

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.data')
const FALLBACK_DATA_DIR = path.join('/tmp', '.data')
let DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? FALLBACK_DATA_DIR : DEFAULT_DATA_DIR)
let DB_FILE = path.join(DATA_DIR, 'damieli.sqlite')
const WASM_PATH = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  } catch (e) {
    if (DATA_DIR !== FALLBACK_DATA_DIR) {
      DATA_DIR = FALLBACK_DATA_DIR
      DB_FILE = path.join(DATA_DIR, 'damieli.sqlite')
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  }
}

ensureDataDir()

let SQL: any = null
let useJsonFallback = false
let useBetterSqlite = false
let betterDb: any = null
const JSON_DB_FILE = path.join(DATA_DIR, 'damieli.json')
const LEGACY_DB_FILE = path.join(DATA_DIR, 'hireme.sqlite')

// Try to load better-sqlite3 native binding if installed
let betterSqliteInitialized = false
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BetterSqlite3 = require('better-sqlite3')
  // Ensure data dir exists
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  betterDb = new BetterSqlite3(DB_FILE)
  
  // Initialize tables immediately
  try {
    betterDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        passwordHash TEXT,
        createdAt TEXT
      );
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        userId TEXT,
        role TEXT,
        company TEXT,
        jobUrl TEXT,
        generatedAt TEXT,
        atsScore INTEGER,
        matchedKeywords TEXT,
        timeSavedMinutes INTEGER,
        cvData TEXT
      );
      CREATE TABLE IF NOT EXISTS app_state (
        userId TEXT PRIMARY KEY,
        profile TEXT,
        stats TEXT
      );
    `)
    useBetterSqlite = true
    betterSqliteInitialized = true
    console.log('[DB] Using better-sqlite3')
  } catch (e) {
    console.warn('[DB] Failed to initialize better-sqlite3 tables, falling back', e)
    useBetterSqlite = false
    betterDb = null
  }
} catch (e) {
  // not available or failed to load — we'll fallback to sql.js or JSON
  console.warn('[DB] better-sqlite3 not available, will use sql.js or JSON fallback')
  useBetterSqlite = false
}

async function prepareDb() {
  // If native better-sqlite3 is available, ensure tables exist and return a thin handle
  if (useBetterSqlite && betterDb) {
    try {
      betterDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          passwordHash TEXT,
          createdAt TEXT
        )
      `)

      betterDb.exec(`
        CREATE TABLE IF NOT EXISTS history (
          id TEXT PRIMARY KEY,
          userId TEXT,
          role TEXT,
          company TEXT,
          jobUrl TEXT,
          generatedAt TEXT,
          atsScore INTEGER,
          matchedKeywords TEXT,
          timeSavedMinutes INTEGER,
          cvData TEXT
        )
      `)

      betterDb.exec(`
        CREATE TABLE IF NOT EXISTS app_state (
          userId TEXT PRIMARY KEY,
          profile TEXT,
          stats TEXT
        )
      `)

      // If a JSON store exists, migrate it into SQLite (one-time import)
      if (fs.existsSync(JSON_DB_FILE)) {
        try {
          const raw = fs.readFileSync(JSON_DB_FILE, 'utf-8')
          const store = JSON.parse(raw)
          // simple existence check: if users table empty, migrate
          const row = betterDb.prepare('SELECT COUNT(1) as c FROM users').get()
          if (row && row.c === 0) {
            const insertUser = betterDb.prepare('INSERT OR IGNORE INTO users (id, email, passwordHash, createdAt) VALUES (@id, @email, @passwordHash, @createdAt)')
            const insertHistory = betterDb.prepare('INSERT OR IGNORE INTO history (id, userId, role, company, jobUrl, generatedAt, atsScore, matchedKeywords, timeSavedMinutes, cvData) VALUES (@id, @userId, @role, @company, @jobUrl, @generatedAt, @atsScore, @matchedKeywords, @timeSavedMinutes, @cvData)')
            const insertAppState = betterDb.prepare('INSERT OR REPLACE INTO app_state (userId, profile, stats) VALUES (@userId, @profile, @stats)')
            const utran = betterDb.transaction((users: any[]) => {
              for (const u of users) insertUser.run({ id: u.id, email: u.email, passwordHash: u.passwordHash, createdAt: u.createdAt })
            })
            const htran = betterDb.transaction((hist: any[]) => {
              for (const h of hist) insertHistory.run({ id: h.id, userId: h.userId, role: h.role, company: h.company, jobUrl: h.jobUrl || '', generatedAt: h.generatedAt, atsScore: h.atsScore || 0, matchedKeywords: h.matchedKeywords || '[]', timeSavedMinutes: h.timeSavedMinutes || 0, cvData: h.cvData || '{}' })
            })
            utran(store.users || [])
            htran(store.history || [])
            const appKeys = Object.keys(store.app_state || {})
            for (const k of appKeys) {
              insertAppState.run({ userId: k, profile: JSON.stringify(store.app_state[k].profile || {}), stats: JSON.stringify(store.app_state[k].stats || {}) })
            }
          }
        } catch (e) {
          console.warn('Migration from JSON store to better-sqlite3 failed', e)
        }
      }

      return betterDb
    } catch (e) {
      console.warn('better-sqlite3 init failed, falling back to sql.js/json', e)
      useBetterSqlite = false
    }
  }

  if (!SQL) {
    try {
      SQL = await initSqlJs({ locateFile: () => WASM_PATH })
    } catch (e) {
      console.warn('sql.js init failed, falling back to JSON store', e)
      useJsonFallback = true
    }
  }

  if (useJsonFallback) {
    // JSON fallback doesn't need preparation
    return null
  }

  const fileData = fs.existsSync(DB_FILE) ? new Uint8Array(fs.readFileSync(DB_FILE)) : undefined
  const db = fileData ? new SQL.Database(fileData) : new SQL.Database()

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      passwordHash TEXT,
      createdAt TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      userId TEXT,
      role TEXT,
      company TEXT,
      jobUrl TEXT,
      generatedAt TEXT,
      atsScore INTEGER,
      matchedKeywords TEXT,
      timeSavedMinutes INTEGER,
      cvData TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      userId TEXT PRIMARY KEY,
      profile TEXT,
      stats TEXT
    )
  `)

  return db
}

function persistDb(db: any) {
  // only relevant for sql.js in-memory DB
  if (useBetterSqlite) return
  const data = db.export()
  fs.writeFileSync(DB_FILE, Buffer.from(data))
}

function loadJsonStore() {
  if (!fs.existsSync(JSON_DB_FILE)) {
    const initial = { users: [], history: [], app_state: {} }
    fs.writeFileSync(JSON_DB_FILE, JSON.stringify(initial, null, 2))
    return initial
  }
  try {
    return JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf-8'))
  } catch (e) {
    console.warn('Failed to read JSON DB, recreating', e)
    const initial = { users: [], history: [], app_state: {} }
    fs.writeFileSync(JSON_DB_FILE, JSON.stringify(initial, null, 2))
    return initial
  }
}

function persistJsonStore(store: any) {
  fs.writeFileSync(JSON_DB_FILE, JSON.stringify(store, null, 2))
}

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  createdAt: string
}

export async function createUser(user: UserRecord) {
  try {
    if (useJsonFallback) {
      const store = loadJsonStore()
      const exists = store.users.some((x: any) => String(x.email).trim().toLowerCase() === String(user.email).trim().toLowerCase())
      if (exists) {
        throw new Error('Email already in use')
      }
      store.users.push(user)
      persistJsonStore(store)
      return
    }
    if (useBetterSqlite && betterDb) {
      const stmt = betterDb.prepare('INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)')
      stmt.run(user.id, user.email, user.passwordHash, user.createdAt)
      return
    }
    const db = await prepareDb()
    const stmt = db.prepare('INSERT INTO users VALUES (?, ?, ?, ?)')
    stmt.run(user.id, user.email, user.passwordHash, user.createdAt)
    stmt.free()
    persistDb(db)
  } catch (e) {
    console.error('createUser error', e)
    throw e
  }
}

export async function findUsersByEmail(email: string) {
  try {
    const normalizedEmail = String(email).trim().toLowerCase()
    if (useJsonFallback) {
      const store = loadJsonStore()
      return store.users.filter((x: any) => String(x.email).trim().toLowerCase() === normalizedEmail) as UserRecord[]
    }
    if (useBetterSqlite && betterDb) {
      const stmt = betterDb.prepare('SELECT * FROM users WHERE email = ?')
      const rows = stmt.all(normalizedEmail)
      return (rows || []) as UserRecord[]
    }
    const db = await prepareDb()
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?')
    stmt.bind([normalizedEmail])
    const users: UserRecord[] = []
    while (stmt.step()) {
      users.push(stmt.getAsObject() as UserRecord)
    }
    stmt.free()
    return users
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
    if (useJsonFallback) {
      const store = loadJsonStore()
      const u = store.users.find((x: any) => x.id === id)
      return u || null
    }
    if (useBetterSqlite && betterDb) {
      const row = betterDb.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(id)
      return (row || null) as UserRecord | null
    }
    const db = await prepareDb()
    const stmt = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
    stmt.bind([id])
    const row = stmt.step() ? stmt.getAsObject() : null
    stmt.free()
    return row as UserRecord | null
  } catch (e) {
    console.error('findUserById error', e)
    return null
  }
}

export async function saveGeneratedCV(cv: any, userId: string) {
  try {
    if (useJsonFallback) {
      const store = loadJsonStore()
      store.history.push({
        id: cv.id,
        userId,
        role: cv.role,
        company: cv.company,
        jobUrl: cv.jobUrl || '',
        generatedAt: cv.generatedAt,
        atsScore: cv.atsScore || 0,
        matchedKeywords: JSON.stringify(cv.matchedKeywords || []),
        timeSavedMinutes: cv.timeSavedMinutes || 0,
        cvData: JSON.stringify(cv.cvData || {}),
      })
      persistJsonStore(store)
      return
    }
    if (useBetterSqlite && betterDb) {
      const stmt = betterDb.prepare('INSERT OR REPLACE INTO history (id, userId, role, company, jobUrl, generatedAt, atsScore, matchedKeywords, timeSavedMinutes, cvData) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      stmt.run(cv.id, userId, cv.role, cv.company, cv.jobUrl || '', cv.generatedAt, cv.atsScore || 0, JSON.stringify(cv.matchedKeywords || []), cv.timeSavedMinutes || 0, JSON.stringify(cv.cvData || {}))
      return
    }
    const db = await prepareDb()
    const stmt = db.prepare('INSERT OR REPLACE INTO history VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    stmt.run(
      cv.id,
      userId,
      cv.role,
      cv.company,
      cv.jobUrl || '',
      cv.generatedAt,
      cv.atsScore || 0,
      JSON.stringify(cv.matchedKeywords || []),
      cv.timeSavedMinutes || 0,
      JSON.stringify(cv.cvData || {})
    )
    stmt.free()
    persistDb(db)
  } catch (e) {
    console.error('saveGeneratedCV error', e)
  }
}

export async function saveAppState(userId: string, state: { profile: any; stats: any; history?: any[]; templateId?: string; outputLanguage?: string }) {
  try {
    const fullState = {
      profile: state.profile || {},
      stats: state.stats || {},
      history: state.history || [],
      templateId: state.templateId || 'modern',
      outputLanguage: state.outputLanguage || 'English',
    }

    if (useJsonFallback) {
      const store = loadJsonStore()
      store.app_state[userId] = fullState
      persistJsonStore(store)
      return
    }
    if (useBetterSqlite && betterDb) {
      const stmt = betterDb.prepare('INSERT OR REPLACE INTO app_state (userId, profile, stats) VALUES (?, ?, ?)')
      stmt.run(userId, JSON.stringify(fullState), JSON.stringify(state.stats || {}))
      return
    }
    const db = await prepareDb()
    const stmt = db.prepare('INSERT OR REPLACE INTO app_state VALUES (?, ?, ?)')
    stmt.run(userId, JSON.stringify(fullState), JSON.stringify(state.stats || {}))
    stmt.free()
    persistDb(db)
  } catch (e) {
    console.error('saveAppState error', e)
  }
}

export async function getAppState(userId: string) {
  try {
    if (useJsonFallback) {
      const store = loadJsonStore()
      const s = store.app_state[userId]
      if (!s) return null
      if (s.profile && typeof s.profile === 'object' && 'profile' in s.profile) {
        return s.profile
      }
      return { profile: s.profile || {}, stats: s.stats || {}, history: s.history || [], templateId: s.templateId || 'modern', outputLanguage: s.outputLanguage || 'English' }
    }
    if (useBetterSqlite && betterDb) {
      const row = betterDb.prepare('SELECT * FROM app_state WHERE userId = ? LIMIT 1').get(userId)
      if (!row) return null
      const parsed = JSON.parse(row.profile || '{}')
      if (parsed && typeof parsed === 'object' && 'profile' in parsed) {
        return parsed
      }
      return { profile: parsed || {}, stats: JSON.parse(row.stats || '{}'), history: [], templateId: 'modern', outputLanguage: 'English' }
    }
    const db = await prepareDb()
    const stmt = db.prepare('SELECT * FROM app_state WHERE userId = ? LIMIT 1')
    stmt.bind([userId])
    const row = stmt.step() ? stmt.getAsObject() : null
    stmt.free()
    if (!row) return null
    const parsed = JSON.parse(row.profile || '{}')
    if (parsed && typeof parsed === 'object' && 'profile' in parsed) {
      return parsed
    }
    return {
      profile: parsed || {},
      stats: JSON.parse(row.stats || '{}'),
      history: [],
      templateId: 'modern',
      outputLanguage: 'English',
    }
  } catch (e) {
    console.error('getAppState error', e)
    return null
  }
}

export async function getHistory(userId: string) {
  try {
    if (useJsonFallback) {
      const store = loadJsonStore()
      const rows = (store.history || []).filter((h: any) => h.userId === userId)
      rows.sort((a: any, b: any) => (b.generatedAt || '').localeCompare(a.generatedAt || ''))
      return rows.map((item: any) => ({
        ...item,
        matchedKeywords: JSON.parse(item.matchedKeywords || '[]'),
        cvData: JSON.parse(item.cvData || '{}'),
      }))
    }
    if (useBetterSqlite && betterDb) {
      const rows = betterDb.prepare('SELECT * FROM history WHERE userId = ? ORDER BY generatedAt DESC').all(userId)
      return rows.map((item: any) => ({ ...item, matchedKeywords: JSON.parse(item.matchedKeywords || '[]'), cvData: JSON.parse(item.cvData || '{}') }))
    }
    const db = await prepareDb()
    const stmt = db.prepare('SELECT * FROM history WHERE userId = ? ORDER BY generatedAt DESC')
    stmt.bind([userId])
    const rows: any[] = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return rows.map(item => ({
      ...item,
      matchedKeywords: JSON.parse(item.matchedKeywords || '[]'),
      cvData: JSON.parse(item.cvData || '{}'),
    }))
  } catch (e) {
    console.error('getHistory error', e)
    return []
  }
}

export default { saveGeneratedCV, getHistory, saveAppState, getAppState, createUser, findUserByEmail, findUserById }
