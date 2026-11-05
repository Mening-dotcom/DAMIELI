'use client'
import React from 'react'
import { AppState, UserProfile } from '@/lib/types'
import { Screen } from './ui'

export function HomeTab({ stats, profile, strength, isMobile, outputLanguage, updateOutputLanguage, setScreen }: {
  stats: AppState['stats']
  profile: UserProfile
  strength: number
  isMobile: boolean
  outputLanguage: 'English' | 'Spanish'
  updateOutputLanguage: (l: 'English' | 'Spanish') => void
  setScreen: (s: Screen) => void
}) {
  const responsiveStatsGrid = isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))'
  const responsiveSplitGrid = isMobile ? '1fr' : '1.4fr 1fr'
  const responsiveTwoColGrid = isMobile ? '1fr' : '1fr 1fr'
  return (
          <div className="fade-in">
            <div style={{ marginBottom: 28, display: 'grid', gap: 20 }}>
              <div style={{ padding: '30px 34px', borderRadius: 24, background: 'rgba(5,70,90,0.96)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 28px 70px rgba(0,0,0,0.12)' }}>
                <h1 style={{ fontSize: 38, fontWeight: 900, letterSpacing: -0.9, marginBottom: 12, color: '#fff' }}>Faster CV creation with polished downloads.</h1>
                <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.7, maxWidth: 760, marginBottom: 16 }}>A fast workspace for building your profile, matching jobs, and exporting ready-to-use resumes in PDF or Word.</p>
                <div style={{ display: 'grid', gridTemplateColumns: responsiveStatsGrid, gap: 12, marginTop: 12 }}>
                  {[
                    { label: 'Fast resume drafts', value: '30 sec' },
                    { label: 'Tailored job matches', value: stats.cvsGenerated + ' done' },
                    { label: 'History saved', value: stats.totalTimeSaved + 'm' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '18px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}> {item.label}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: responsiveSplitGrid, gap: 18 }}>
                <div style={{ padding: '26px 28px', borderRadius: 22, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: '#0b3d91', marginBottom: 12 }}>Your next move</div>
                  <div style={{ fontSize: 15, color: '#0b3d91', lineHeight: 1.75, marginBottom: 16 }}>Build your profile, match jobs, and export resume files in one clean workflow.</div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {['Update your profile', 'Paste a job description', 'Generate a tailored CV', 'Download ready resume files'].map(line => (
                      <div key={line} style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#0b3d91', fontSize: 13 }}>
                        <span style={{ width: 20, height: 20, borderRadius: 999, background: 'rgba(56,189,248,0.3)', display: 'grid', placeItems: 'center', color: '#ecfeff', fontSize: 12 }}>✓</span>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '26px 28px', borderRadius: 22, background: 'rgba(7,90,108,0.96)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--info)', marginBottom: 12 }}>Features</div>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: '#e7e5df' }}>A fast, focused dashboard made for clean CV creation and export.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(56,189,248,0.16)', border: '1px solid rgba(56,189,248,0.24)', color: '#fff' }}>Create CVs in English or Spanish with one tap.</div>
                    <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--muted)' }}>Save your profile, match jobs, and export resumes instantly.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: responsiveStatsGrid, gap: 14, marginBottom: 24 }}>
              {[
                { val: stats.cvsGenerated, label: 'CVs generated', color: '#38bdf8', icon: '⚡' },
                { val: stats.jobsAnalyzed, label: 'Jobs analyzed', color: '#2dd4bf', icon: '🎯' },
                { val: stats.totalTimeSaved + 'm', label: 'Time saved', color: '#22c55e', icon: '⏱️' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 12, padding: '20px', boxShadow: '0 10px 30px rgba(6, 58, 75, 0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
                    <div style={{ fontFamily: 'Syne', fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#0f172a', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Profile strength */}
            {strength < 100 && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 14 }}>Profile strength</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{strength}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--surface3)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: strength + '%', background: 'var(--accent)', borderRadius: 100, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {[
                    { label: 'Basic info', done: !!(profile.name && profile.email) },
                    { label: 'Work experience', done: profile.jobs.length > 0 },
                    { label: 'Education', done: profile.education.length > 0 },
                    { label: 'Skills', done: profile.skills.length >= 5 },
                    { label: 'Languages', done: profile.languages.length > 0 },
                    { label: 'Summary', done: profile.summary.length > 50 },
                  ].map(item => (
                    <span key={item.label} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 100, background: item.done ? 'rgba(200,240,74,0.12)' : 'var(--surface3)', color: item.done ? 'var(--accent)' : 'var(--muted)' }}>
                      {item.done ? '✓ ' : ''}{item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: responsiveTwoColGrid, gap: 12, marginBottom: 20 }}>
              {[
                { icon: '⚡', title: 'Generate CV', sub: 'Paste a job URL or description and get a tailored CV in 30 seconds', action: () => setScreen('generate') },
                { icon: '👤', title: 'Build Profile', sub: 'Add all your experience — past jobs, courses, languages, everything', action: () => setScreen('profile') },
              ].map(q => (
                <div key={q.title} onClick={q.action} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{q.icon}</div>
                  <div style={{ fontFamily: 'Syne', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{q.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{q.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(56,189,248,0.24)', borderRadius: 18, padding: '20px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, color: '#0b3d91', marginBottom: 6 }}>CV language</div>
                <div style={{ fontSize: 13, color: '#0b3d91' }}>Choose the language used when generating your tailored CV.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto' }}>
                {(['English', 'Spanish'] as const).map(lang => (
                  <button key={lang} onClick={() => updateOutputLanguage(lang)} style={{ padding: '10px 18px', borderRadius: 999, border: outputLanguage === lang ? '1px solid #0b3d91' : '1px solid rgba(13,110,253,0.2)', background: outputLanguage === lang ? '#0b7cde' : 'rgba(255,255,255,0.12)', color: outputLanguage === lang ? '#fff' : '#0b3d91', cursor: 'pointer', fontSize: 13, minWidth: isMobile ? '100%' : 100 }}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'rgba(56,189,248,0.14)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#0f172a', lineHeight: 1.7 }}>
              <span style={{ color: '#0284c7', fontWeight: 600 }}>Pro tip:</span> Add every job you&apos;ve ever had — even unrelated ones. More detail means a smarter, sharper CV for the role you want.
            </div>
          </div>
  )
}
