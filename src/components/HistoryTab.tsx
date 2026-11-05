'use client'
import React from 'react'
import { AppState, UserProfile, GeneratedCV } from '@/lib/types'
import { downloadPDF } from '@/lib/export'
import { ghostBtnStyle, primaryBtnStyle } from './ui'

export function HistoryTab({ history, stats, profile, serverHistory, isMobile, effectiveTemplateId, onView, onRefreshServer }: {
  history: GeneratedCV[]
  stats: AppState['stats']
  profile: UserProfile
  serverHistory: GeneratedCV[]
  isMobile: boolean
  effectiveTemplateId: string
  onView: (cv: GeneratedCV) => void
  onRefreshServer: () => void
}) {
  const responsiveTwoColGrid = isMobile ? '1fr' : '1fr 1fr'
  return (
          <div className="fade-in">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4, color: '#0b3d91' }}>History</h1>
              <p style={{ color: '#0b3d91', fontSize: 13 }}>All your generated CVs — {stats.totalTimeSaved} minutes saved so far</p>
              <p style={{ color: '#0b3d91', fontSize: 12, marginTop: 6 }}>Choose English or Spanish before generating your CV.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 12, color: '#0b3d91' }}>
                <span>{serverHistory.length} records stored on the server</span>
                <button onClick={onRefreshServer} style={{ border: '1px solid #0b3d91', background: 'transparent', color: '#0b3d91', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Refresh server history</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: responsiveTwoColGrid, gap: 12, marginBottom: 20 }}>
              <div style={{ padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 12, color: '#0b3d91', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Local history</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0b3d91' }}>{history.length}</div>
                <div style={{ fontSize: 12, color: '#0b3d91', marginTop: 6 }}>CVs stored in this browser.</div>
              </div>
              <div style={{ padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 12, color: '#0b3d91', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Server history</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0b3d91' }}>{serverHistory.length}</div>
                <div style={{ fontSize: 12, color: '#0b3d91', marginTop: 6 }}>CVs backed up to your account.</div>
              </div>
            </div>

            {history.length === 0 && serverHistory.length === 0 && (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>No CVs generated yet. Start with Generate CV to see your first draft here.</div>
            )}

            {history.map(h => (
              <div key={h.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: 12, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{h.role} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>@ {h.company}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {h.generatedAt} · ATS: <span style={{ color: 'var(--accent)' }}>{h.atsScore}%</span> · {h.matchedKeywords.slice(0, 3).join(', ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row', width: isMobile ? '100%' : 'auto' }}>
                  <button onClick={() => onView(h)} style={ghostBtnStyle}>View</button>
                  <button onClick={() => downloadPDF(profile, h.cvData, h.role, undefined, h.templateId || effectiveTemplateId)} style={primaryBtnStyle}>⬇ PDF</button>
                </div>
              </div>
            ))}

            {serverHistory.length > 0 && (
              <div style={{ marginTop: 24, padding: '18px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18 }}>
                <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--info)', fontWeight: 600 }}>Server-persisted history</div>
                {serverHistory.map(h => (
                  <div key={h.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.role} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>@ {h.company}</span></div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        {h.generatedAt} · ATS: <span style={{ color: 'var(--accent)' }}>{h.atsScore}%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => onView(h)} style={ghostBtnStyle}>View</button>
                      <button onClick={() => downloadPDF(profile, h.cvData, h.role, undefined, h.templateId || effectiveTemplateId)} style={primaryBtnStyle}>⬇ PDF</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
  )
}
