'use client'
// Shared UI kit: form primitives, cards, modal shell, and the style
// constants every screen uses.
import React from 'react'

export type Screen = 'home' | 'jobs' | 'settings' | 'profile' | 'generate' | 'history'

// ─── Style constants ───────────────────────────────────────────────
// ─── Style constants ───────────────────────────────────────────────
export const inputStyle: React.CSSProperties = { width: '100%', background: '#ffffff', border: '1px solid #dfe4f3', borderRadius: 10, padding: '11px 14px', color: '#0e1430', fontFamily: 'DM Sans', fontSize: 13, outline: 'none' }
export const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 120 }
export const primaryBtnStyle: React.CSSProperties = { padding: '11px 18px', borderRadius: 12, background: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 700, boxShadow: '0 10px 26px rgba(79,70,229,0.30)' }
export const ghostBtnStyle: React.CSSProperties = { padding: '9px 14px', borderRadius: 10, background: '#ffffff', color: '#4f46e5', border: '1px solid #dfe4f3', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600 }

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 14 }}>
      <div style={{ fontFamily: 'Syne', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginBottom: 5, fontWeight: 500 }}>{label}</label>{children}</div>
}

export function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
}

export function EntryItem({ title, sub, onEdit, onDelete }: { title: string; sub: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div><div style={{ fontWeight: 500, fontSize: 14 }}>{title}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div></div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onEdit} style={ghostBtnStyle}>Edit</button>
        <button onClick={onDelete} style={{ ...ghostBtnStyle, color: 'var(--danger)', borderColor: 'rgba(255,95,95,0.2)' }}>Delete</button>
      </div>
    </div>
  )
}

export function AddBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: '100%', padding: '10px', background: 'var(--surface2)', border: '1px dashed var(--border2)', borderRadius: 10, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 13, transition: 'all 0.15s', marginTop: 4 }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)' }}>
      {children}
    </button>
  )
}

export function Modal({ title, children, onClose, onSave }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Syne', fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
          <button onClick={onSave} style={primaryBtnStyle}>Save</button>
        </div>
      </div>
    </div>
  )
}
