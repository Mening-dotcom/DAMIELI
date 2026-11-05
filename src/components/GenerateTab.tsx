'use client'
import React from 'react'
import { UserProfile, GeneratedCV } from '@/lib/types'
import { CV_TEMPLATES } from '@/lib/templates'
import { downloadPDF, downloadWord } from '@/lib/export'
import { CVPreview } from './CVPreview'
import { Field, Input, inputStyle, textareaStyle, primaryBtnStyle, ghostBtnStyle } from './ui'

export function GenerateTab({ profile, jobUrl, setJobUrl, jobText, setJobText, jobCompany, setJobCompany, jobRole, setJobRole, fetchingUrl, fetchJob, generate, generating, genStatus, currentCV, outputLanguage, updateOutputLanguage, selectedTemplate, updateTemplateSelection, cvTab, setCvTab, tailoringNotes, effectiveTemplateId, previewRef, buildRawText, isMobile }: {
  profile: UserProfile
  jobUrl: string
  setJobUrl: (v: string) => void
  jobText: string
  setJobText: (v: string) => void
  jobCompany: string
  setJobCompany: (v: string) => void
  jobRole: string
  setJobRole: (v: string) => void
  fetchingUrl: boolean
  fetchJob: () => void
  generate: () => void
  generating: boolean
  genStatus: string
  currentCV: GeneratedCV | null
  outputLanguage: 'English' | 'Spanish'
  updateOutputLanguage: (l: 'English' | 'Spanish') => void
  selectedTemplate: string
  updateTemplateSelection: (id: string) => void
  cvTab: 'preview' | 'raw'
  setCvTab: (t: 'preview' | 'raw') => void
  tailoringNotes: string
  effectiveTemplateId: string
  previewRef: React.MutableRefObject<HTMLDivElement | null>
  buildRawText: (cv: GeneratedCV) => string
  isMobile: boolean
}) {
  const responsiveTemplateGrid = isMobile ? '1fr' : 'repeat(3, 1fr)'
  return (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 }}>Generate CV</h1>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Paste a job link or description — the system reads it and matches your CV to the role.</p>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Syne', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>What job are you applying to?</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.7 }}>
                Paste the URL or full job text below. The tool extracts keywords, requirements, and tone — then rebuilds your CV to match with confidence.
              </div>

              {/* URL row */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexDirection: isMobile ? 'column' : 'row' }}>
                <input value={jobUrl} onChange={e => setJobUrl(e.target.value)} placeholder="https://linkedin.com/jobs/... or any job URL" style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
                <button onClick={fetchJob} disabled={fetchingUrl || !jobUrl} style={{ ...primaryBtnStyle, opacity: fetchingUrl || !jobUrl ? 0.5 : 1, width: isMobile ? '100%' : 'auto' }}>
                  {fetchingUrl ? '...' : 'Fetch'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', fontSize: 12, margin: '12px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /> or paste directly <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <Field label="Full job description">
                <textarea value={jobText} onChange={e => setJobText(e.target.value)} rows={9} placeholder="Paste the complete job description here — responsibilities, requirements, nice-to-haves, company info. The more detail provided, the sharper the match." style={textareaStyle} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
                <Field label="Company name"><Input value={jobCompany} onChange={setJobCompany} placeholder="Acme Corp" /></Field>
                <Field label="Role title"><Input value={jobRole} onChange={setJobRole} placeholder="Senior Software Engineer" /></Field>
                <Field label="Language">
                  <select value={outputLanguage} onChange={e => updateOutputLanguage(e.target.value as 'English' | 'Spanish')} style={inputStyle}>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                  </select>
                </Field>
              </div>

              <div style={{ marginTop: 20 }}>
                <button onClick={generate} disabled={generating || !jobText.trim()} style={{ ...primaryBtnStyle, padding: '12px 28px', fontSize: 15, opacity: generating || !jobText.trim() ? 0.5 : 1 }}>
                  {generating ? '⏳ Generating...' : '⚡ Generate tailored CV'}
                </button>
              </div>
            </div>

            {/* Status */}
            {genStatus && genStatus !== 'done' && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', marginBottom: 16, fontSize: 13, color: genStatus.startsWith('Error') ? 'var(--danger)' : 'var(--info)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {!genStatus.startsWith('Error') && <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--info)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
                {genStatus}
              </div>
            )}

            {/* Result */}
            {currentCV && (
              <div className="fade-in">
                {/* Download bar */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: 16, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
                  <div style={{ fontSize: 13 }}>
                    CV tailored for <strong style={{ color: 'var(--accent)' }}>{currentCV.role}</strong> @ <strong style={{ color: 'var(--accent)' }}>{currentCV.company}</strong>
                    <span style={{ marginLeft: 12, background: 'rgba(74,240,160,0.12)', color: 'var(--success)', fontSize: 11, padding: '2px 10px', borderRadius: 100, border: '1px solid rgba(74,240,160,0.2)' }}>ATS Optimized ✓</span>
                    <span style={{ marginLeft: 8, background: 'rgba(95,184,255,0.1)', color: 'var(--info)', fontSize: 11, padding: '2px 10px', borderRadius: 100, border: '1px solid rgba(95,184,255,0.2)' }}>⏱ ~{currentCV.timeSavedMinutes}min saved</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => downloadWord(profile, currentCV.cvData, currentCV.role)} style={ghostBtnStyle}>⬇ Word</button>
                    <button onClick={() => downloadPDF(profile, currentCV.cvData, currentCV.role, previewRef.current, effectiveTemplateId)} style={primaryBtnStyle}>⬇ PDF</button>
                  </div>
                </div>

                {/* ATS */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 12 }}>ATS Analysis</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                    <span>Keyword match score</span><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{currentCV.atsScore}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 100, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ height: '100%', width: currentCV.atsScore + '%', background: currentCV.atsScore > 80 ? 'var(--success)' : currentCV.atsScore > 60 ? 'var(--accent)' : 'var(--danger)', borderRadius: 100, transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {currentCV.matchedKeywords.map(kw => (
                      <span key={kw} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 100, background: 'rgba(200,240,74,0.1)', color: 'var(--accent)', border: '1px solid rgba(200,240,74,0.2)' }}>{kw}</span>
                    ))}
                  </div>
                  {tailoringNotes && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(95,184,255,0.06)', border: '1px solid rgba(95,184,255,0.15)', borderRadius: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                      <strong style={{ color: 'var(--info)' }}>Tailoring notes:</strong> {tailoringNotes}
                    </div>
                  )}
                </div>

                {/* Template Selector */}
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '18px 22px', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#666', marginBottom: 14 }}>📋 CV Template</div>
                  <div style={{ display: 'grid', gridTemplateColumns: responsiveTemplateGrid, gap: 10 }}>
                    {CV_TEMPLATES.map(t => (
                      <button key={t.id} onClick={() => updateTemplateSelection(t.id)} style={{ padding: '12px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: selectedTemplate === t.id ? '#fff' : '#555', background: selectedTemplate === t.id ? '#c8f04a' : '#f3f4f6', border: selectedTemplate === t.id ? '2px solid #b8d63e' : '1px solid #d1d5db', fontWeight: selectedTemplate === t.id ? 600 : 500, transition: 'all 0.15s', textAlign: 'left' }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CV Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                  {(['preview', 'raw'] as const).map(t => (
                    <button key={t} onClick={() => setCvTab(t)} style={{ padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: cvTab === t ? 'var(--text)' : 'var(--muted)', background: cvTab === t ? 'var(--surface2)' : 'none', border: cvTab === t ? '1px solid var(--border)' : '1px solid transparent', fontFamily: 'DM Sans', transition: 'all 0.15s' }}>
                      {t === 'preview' ? 'CV Preview' : 'Plain text'}
                    </button>
                  ))}
                </div>

                {cvTab === 'preview' && <CVPreview profile={profile} cvData={currentCV.cvData} templateId={effectiveTemplateId} containerRef={previewRef} isMobile={isMobile} />}
                {cvTab === 'raw' && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--text)', fontFamily: 'DM Sans', lineHeight: 1.7 }}>{buildRawText(currentCV)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
  )
}
