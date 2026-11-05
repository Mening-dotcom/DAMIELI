'use client'
import React from 'react'
import { AppState } from '@/lib/types'
import { Screen } from './ui'

export function Sidebar({ isMobile, sidebarOpen, setSidebarOpen, screen, onNav, currentUser, logout, setAuthModal, syncStatus, stats }: {
  isMobile: boolean
  sidebarOpen: boolean
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>
  screen: Screen
  onNav: (s: Screen) => void
  currentUser: { id: string; email: string } | null
  logout: () => void
  setAuthModal: (m: 'login' | 'signup' | null) => void
  syncStatus: string
  stats: AppState['stats']
}) {
  return (
    <>
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
              <button key={s} onClick={() => onNav(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontSize: 13, marginBottom: 8, background: screen === s ? 'rgba(255,255,255,0.18)' : 'transparent', color: screen === s ? '#fff' : '#c7d2fe', fontFamily: 'DM Sans', fontWeight: screen === s ? 700 : 500, transition: 'all 0.15s' }}>
                <span style={{ fontSize: 13 }}>{icons[i]}</span> {labels[i]}
              </button>
            )
          })}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: '#c4ccf8', lineHeight: 1.6 }}>
          Created by Steven M<br />
          <span style={{ color: 'var(--success)' }}>●</span> {stats.cvsGenerated} CVs generated<br />
          <span style={{ color: 'var(--info)' }}>⏱</span> {stats.totalTimeSaved}m saved
        </div>
      </nav>
    </>
  )
}
