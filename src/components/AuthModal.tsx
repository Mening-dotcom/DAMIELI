'use client'
import React from 'react'
import { Modal, Field, Input, inputStyle, ghostBtnStyle, primaryBtnStyle } from './ui'

export function AuthModal({ authModal, setAuthModal, authEmail, setAuthEmail, authPassword, setAuthPassword, authStatus, syncStatus, authLoading, authRequest }: {
  authModal: 'login' | 'signup' | null
  setAuthModal: (m: 'login' | 'signup' | null) => void
  authEmail: string
  setAuthEmail: (v: string) => void
  authPassword: string
  setAuthPassword: (v: string) => void
  authStatus: string
  syncStatus: string
  authLoading: boolean
  authRequest: (mode: 'login' | 'signup') => void
}) {
  if (!authModal) return null
  return (
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
  )
}
