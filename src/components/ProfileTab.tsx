'use client'
import React, { useRef } from 'react'
import { UserProfile } from '@/lib/types'
import { Card, Field, Input, EntryItem, AddBtn, Screen, inputStyle, textareaStyle, ghostBtnStyle, primaryBtnStyle } from './ui'

export type ModalKind = 'job' | 'edu' | 'cert' | 'lang'

export function ProfileTab({ profile, updateProfile, skillInput, setSkillInput, openModal, onCVUpload, setScreen, isMobile }: {
  profile: UserProfile
  updateProfile: (p: Partial<UserProfile>) => void
  skillInput: string
  setSkillInput: (v: string) => void
  openModal: (kind: ModalKind, form: object, idx: number | null) => void
  onCVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  setScreen: (s: Screen) => void
  isMobile: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const responsiveTwoColGrid = isMobile ? '1fr' : '1fr 1fr'
  const responsiveThreeColGrid = isMobile ? '1fr' : '1fr 1fr 1fr'
  return (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4, color: '#0b3d91' }}>My Profile</h1>
              <p style={{ color: '#0b3d91', fontSize: 13 }}>The richer your profile, the better every generated CV will be. Add your experience, skills, and projects.</p>
            </div>

            {/* Upload CV */}
            <div style={{ background: 'rgba(95,184,255,0.05)', border: '1px solid rgba(95,184,255,0.2)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, color: '#0b3d91' }}>Upload existing CV</div>
                <div style={{ fontSize: 12, color: '#0b3d91', marginTop: 2 }}>
                  {profile.uploadedCVText ? '✓ CV text loaded — the generator will use this as additional context' : 'Import your existing CV (.txt) to provide more context'}
                </div>
              </div>
              <button onClick={() => fileRef.current?.click()} style={{ padding: '7px 16px', borderRadius: 8, background: 'rgba(95,184,255,0.12)', color: 'var(--info)', border: '1px solid rgba(95,184,255,0.25)', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans' }}>
                {profile.uploadedCVText ? 'Replace' : 'Upload .txt'}
              </button>
              <input ref={fileRef} type="file" accept=".txt" style={{ display: 'none' }} onChange={onCVUpload} />
            </div>

            {/* Personal Info */}
            <Card title="Personal Info">
              <div style={{ display: 'grid', gridTemplateColumns: responsiveTwoColGrid, gap: 14 }}>
                <Field label="Full name"><Input value={profile.name} onChange={v => updateProfile({ name: v })} placeholder="Steven" /></Field>
                <Field label="Job title / headline"><Input value={profile.headline} onChange={v => updateProfile({ headline: v })} placeholder="Software Engineer" /></Field>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Change your name anytime — this is the name used on all downloads and saved CV previews.</div>
              <div style={{ display: 'grid', gridTemplateColumns: responsiveThreeColGrid, gap: 14 }}>
                <Field label="Email"><Input value={profile.email} onChange={v => updateProfile({ email: v })} placeholder="steven@email.com" /></Field>
                <Field label="Phone"><Input value={profile.phone} onChange={v => updateProfile({ phone: v })} placeholder="+506 ..." /></Field>
                <Field label="Location"><Input value={profile.location} onChange={v => updateProfile({ location: v })} placeholder="San José, CR" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="LinkedIn URL"><Input value={profile.linkedin} onChange={v => updateProfile({ linkedin: v })} placeholder="linkedin.com/in/steven" /></Field>
                <Field label="Portfolio / GitHub"><Input value={profile.portfolio} onChange={v => updateProfile({ portfolio: v })} placeholder="github.com/steven" /></Field>
              </div>
              <Field label="Professional summary — your elevator pitch (the generator adapts this per job)">
                <textarea value={profile.summary} onChange={e => updateProfile({ summary: e.target.value })} rows={3} placeholder="Results-driven software engineer with 5+ years building scalable systems..." style={textareaStyle} />
              </Field>
            </Card>

            {/* Work Experience */}
            <Card title={`Work Experience (${profile.jobs.length})`}>
              {profile.jobs.map((j, i) => (
                <EntryItem key={j.id} title={j.title} sub={`${j.company} · ${j.start} – ${j.end || 'Present'}`}
                  onEdit={() => openModal('job', j, i)}
                  onDelete={() => { const jobs = [...profile.jobs]; jobs.splice(i, 1); updateProfile({ jobs }) }} />
              ))}
              <AddBtn onClick={() => openModal('job', {}, null)}>+ Add position</AddBtn>
            </Card>

            {/* Education */}
            <Card title={`Education (${profile.education.length})`}>
              {profile.education.map((e, i) => (
                <EntryItem key={e.id} title={e.degree} sub={`${e.school} · ${e.endYear}`}
                  onEdit={() => openModal('edu', e, i)}
                  onDelete={() => { const education = [...profile.education]; education.splice(i, 1); updateProfile({ education }) }} />
              ))}
              <AddBtn onClick={() => openModal('edu', {}, null)}>+ Add education</AddBtn>
            </Card>

            {/* Certifications */}
            <Card title={`Courses & Certifications (${profile.certifications.length})`}>
              {profile.certifications.map((c, i) => (
                <EntryItem key={c.id} title={c.name} sub={`${c.issuer}${c.date ? ' · ' + c.date : ''}`}
                  onEdit={() => openModal('cert', c, i)}
                  onDelete={() => { const certifications = [...profile.certifications]; certifications.splice(i, 1); updateProfile({ certifications }) }} />
              ))}
              <AddBtn onClick={() => openModal('cert', {}, null)}>+ Add course / certification</AddBtn>
            </Card>

            {/* Skills */}
            <Card title={`Skills (${profile.skills.length})`}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && skillInput.trim()) { if (!profile.skills.includes(skillInput.trim())) updateProfile({ skills: [...profile.skills, skillInput.trim()] }); setSkillInput('') } }} placeholder="Type a skill and press Enter..." style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => { if (skillInput.trim() && !profile.skills.includes(skillInput.trim())) { updateProfile({ skills: [...profile.skills, skillInput.trim()] }); setSkillInput('') } }} style={ghostBtnStyle}>Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {profile.skills.map(s => (
                  <span key={s} style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: 100, padding: '4px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {s}
                    <button onClick={() => updateProfile({ skills: profile.skills.filter(x => x !== s) })} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            </Card>

            {/* Languages */}
            <Card title={`Languages (${profile.languages.length})`}>
              {profile.languages.map((l, i) => (
                <EntryItem key={l.id} title={l.name} sub={l.level}
                  onEdit={() => openModal('lang', l, i)}
                  onDelete={() => { const languages = [...profile.languages]; languages.splice(i, 1); updateProfile({ languages }) }} />
              ))}
              <AddBtn onClick={() => openModal('lang', {}, null)}>+ Add language</AddBtn>
            </Card>

            {/* Achievements */}
            <Card title="Achievements, Projects & Extra">
              <Field label="Add awards, open source projects, volunteer work, side projects, anything notable">
                <textarea value={profile.achievements} onChange={e => updateProfile({ achievements: e.target.value })} rows={4} placeholder="- Built Cvbuilder.ai or a career tool used by 50+ people&#10;- Won regional hackathon 2023&#10;- Open source contributor: 200+ GitHub stars" style={textareaStyle} />
              </Field>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setScreen('generate')} style={primaryBtnStyle}>Profile saved → Generate CV ⚡</button>
            </div>
          </div>
  )
}
