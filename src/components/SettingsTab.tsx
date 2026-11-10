'use client'
import React from 'react'
import { ghostBtnStyle, primaryBtnStyle } from './ui'

export type SearchPrefs = { modality: string; seniority: string; minSalary: number; zone: string; keywords: string; onlyApplyable: boolean }

export function SettingsTab({ searchPrefs, setSearchPrefs, autoPickRoles, rolesLoading, onSave }: {
  searchPrefs: SearchPrefs
  setSearchPrefs: (p: SearchPrefs) => void
  autoPickRoles: () => void
  rolesLoading: boolean
  onSave: () => void
}) {
          const lbl: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 700, color: '#334155' }
          const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: 14, color: '#0f172a', background: '#fff' }
          return (
          <div style={{ maxWidth: 560 }}>
            <h1 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, margin: '0 0 6px', color: '#0f172a' }}>Search settings</h1>
            <p style={{ color: '#475569', margin: '0 0 20px', fontSize: 14 }}>Tell DAMIELI what you want — these drive the Jobs search.</p>
            <div style={{ display: 'grid', gap: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
              <label style={lbl}>Work style
                <select value={searchPrefs.modality} onChange={e => setSearchPrefs({ ...searchPrefs, modality: e.target.value })} style={inp}>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                  <option value="any">Any</option>
                </select>
              </label>
              <label style={lbl}>Seniority
                <select value={searchPrefs.seniority} onChange={e => setSearchPrefs({ ...searchPrefs, seniority: e.target.value })} style={inp}>
                  <option>Junior</option><option>Mid</option><option>Senior</option><option>Lead</option>
                </select>
              </label>
              <label style={lbl}>Minimum salary (USD / year — 0 = any)
                <input type="number" value={searchPrefs.minSalary} onChange={e => setSearchPrefs({ ...searchPrefs, minSalary: Number(e.target.value) || 0 })} style={inp} />
              </label>
              <label style={lbl}>Zone / country (blank = anywhere)
                <input type="text" placeholder="e.g. Costa Rica, LATAM, Brasil, Worldwide" value={searchPrefs.zone} onChange={e => setSearchPrefs({ ...searchPrefs, zone: e.target.value })} style={inp} />
              </label>
              <label style={lbl}>Role seeds (a few is enough — DAMIELI expands each into every known title variant, English and Spanish, and Smart match finds jobs even when the title is different)
                <input type="text" placeholder="e.g. QA tester, developer, IT support, accounting, credit analyst" value={searchPrefs.keywords} onChange={e => setSearchPrefs({ ...searchPrefs, keywords: e.target.value })} style={inp} />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -4, flexWrap: 'wrap' }}>
                <button type="button" onClick={autoPickRoles} disabled={rolesLoading} style={{ ...ghostBtnStyle, padding: '7px 12px', fontSize: 12 }}>{rolesLoading ? 'Picking…' : '✨ Auto-pick roles from my profile'}</button>
                <span style={{ fontSize: 12, color: '#64748b' }}>Don't have a target title? Let DAMIELI choose remote-friendly roles from your profile.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button onClick={onSave} style={primaryBtnStyle}>Save &amp; search →</button>
              </div>
            </div>
          </div>
          )
}
