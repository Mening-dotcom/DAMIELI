'use client'
import React from 'react'
import { ScoreBadge, EligibilityBadge } from './JobBadges'
import { primaryBtnStyle } from './ui'
import { SearchPrefs } from './SettingsTab'
import { JobListing } from '@/lib/types'

const JOBS_PER_PAGE = 8

export function JobsTab({ jobsList, jobsLoading, jobsError, jobsSources, matching, matchProgress, jobsPage, setJobsPage, expandedJob, setExpandedJob, jobView, setJobView, jobStatusMap, markJob, searchPrefs, setSearchPrefs, loadJobs, scoreMatches, exportApplyList, onImportJobs, onCreateCV }: {
  jobsList: JobListing[]
  jobsLoading: boolean
  jobsError: string
  jobsSources: number
  matching: boolean
  matchProgress: string
  jobsPage: number
  setJobsPage: (n: number) => void
  expandedJob: number | null
  setExpandedJob: (n: number | null) => void
  jobView: 'all' | 'saved' | 'applied' | 'hidden'
  setJobView: (v: 'all' | 'saved' | 'applied' | 'hidden') => void
  jobStatusMap: Record<string, string>
  markJob: (job: JobListing, status: 'saved' | 'applied' | 'hidden') => void
  searchPrefs: SearchPrefs
  setSearchPrefs: (p: SearchPrefs) => void
  loadJobs: () => void
  scoreMatches: () => void
  exportApplyList: () => void
  onImportJobs: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCreateCV: (job: JobListing) => void
}) {
          const pagerBtn = (active: boolean): React.CSSProperties => ({ minWidth: 34, padding: '7px 10px', borderRadius: 8, border: '1px solid ' + (active ? '#4f46e5' : '#cbd5e1'), background: active ? '#4f46e5' : '#fff', color: active ? '#fff' : '#0f172a', fontSize: 12, fontWeight: 600, cursor: 'pointer' })
          const statusBtn = (active: boolean): React.CSSProperties => ({ padding: '9px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (active ? '#4f46e5' : '#dfe4f3'), background: active ? '#eef2ff' : '#fff', color: active ? '#4f46e5' : '#64748b' })
          const statusOf = (j: JobListing) => jobStatusMap[String(j.url || j.title || '')]
          // "all" shows everything EXCEPT jobs you've hidden; the other tabs show
          // exactly that status (saved / applied / hidden).
          let viewed = jobView === 'all' ? jobsList.filter((j) => statusOf(j) !== 'hidden') : jobsList.filter((j) => statusOf(j) === jobView)
          // In the main view, drop roles you can't apply to from Costa Rica.
          // After Smart match we use the AI's real verdict (aiEligible === 'no');
          // before that we fall back to the weak keyword guess. Toggle off for a
          // US citizen (e.g. Nicole).
          const applyFilterOn = searchPrefs.onlyApplyable && jobView === 'all'
          const notApplyable = (j: JobListing) => (j.aiEligible ? j.aiEligible === 'no' : j.eligibility === 'us_only' || j.eligibility === 'restricted')
          const hiddenUsOnly = applyFilterOn ? viewed.filter(notApplyable).length : 0
          if (applyFilterOn) viewed = viewed.filter((j) => !notApplyable(j))
          const totalPages = Math.max(1, Math.ceil(viewed.length / JOBS_PER_PAGE))
          const page = Math.min(jobsPage, totalPages)
          const pageJobs = viewed.slice((page - 1) * JOBS_PER_PAGE, page * JOBS_PER_PAGE)
          return (
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
              <div>
                <h1 style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, margin: 0, color: '#0b3d91' }}>Jobs for you</h1>
                <p style={{ color: '#475569', margin: '6px 0 0', fontSize: 14 }}>
                  {jobsLoading
                    ? 'Searching…'
                    : jobsError
                      ? <span style={{ color: '#ef4444' }}>Error: {jobsError}</span>
                      : <><strong>{viewed.length}</strong> {jobView === 'all' ? 'you can apply to' : jobView} — from <strong>{jobsSources}</strong> sites.{jobView === 'all' && hiddenUsOnly > 0 ? ` ${hiddenUsOnly} US-only tucked away.` : ''} Hit <strong>⭐ Smart match</strong> to rank by fit.</>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={scoreMatches} disabled={matching || jobsLoading || !jobsList.length} style={{ ...primaryBtnStyle, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', boxShadow: 'none', opacity: matching || jobsLoading || !jobsList.length ? 0.6 : 1 }}>{matching ? `⏳ Matching… ${matchProgress}` : '⭐ Smart match'}</button>
                <button onClick={() => loadJobs()} disabled={jobsLoading || matching} style={{ ...primaryBtnStyle, opacity: jobsLoading || matching ? 0.6 : 1 }}>↻ Refresh</button>
                <button onClick={exportApplyList} disabled={!jobsList.length || matching} title="Download your Saved jobs as jobs.json for the Apply Assistant" style={{ ...primaryBtnStyle, background: '#fff', color: '#4f46e5', border: '1px solid #c7d2fe', boxShadow: 'none', opacity: !jobsList.length || matching ? 0.6 : 1 }}>⤓ Export apply list</button>
                <label title="Add the Costa-Rica jobs scraped by the local Apply Assistant (jobs.json) so they get AI-scored here" style={{ ...primaryBtnStyle, background: '#fff', color: '#15803d', border: '1px solid #bbf7d0', boxShadow: 'none', cursor: 'pointer', opacity: matching ? 0.6 : 1 }}>
                  ⤒ Import CR jobs
                  <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={onImportJobs} disabled={matching} />
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['all', 'saved', 'applied', 'hidden'] as const).map((v) => (
                <button key={v} onClick={() => { setJobView(v); setJobsPage(1); setExpandedJob(null) }} style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', border: '1px solid ' + (jobView === v ? '#4f46e5' : '#dfe4f3'), background: jobView === v ? '#4f46e5' : '#fff', color: jobView === v ? '#fff' : '#475569' }}>{v}</button>
              ))}
              <div style={{ width: 1, height: 20, background: '#dfe4f3', margin: '0 2px' }} />
              <button
                onClick={() => { const next = { ...searchPrefs, onlyApplyable: !searchPrefs.onlyApplyable }; setSearchPrefs(next); setJobsPage(1); try { window.localStorage.setItem('damieli_search_prefs', JSON.stringify(next)) } catch { /* ignore */ } }}
                title="Hide jobs that require US work authorization. Turn off if you can legally work in the US."
                style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (searchPrefs.onlyApplyable ? '#16a34a' : '#dfe4f3'), background: searchPrefs.onlyApplyable ? '#dcfce7' : '#fff', color: searchPrefs.onlyApplyable ? '#15803d' : '#475569' }}
              >🌎 Apply from Costa Rica {searchPrefs.onlyApplyable ? 'ON' : 'OFF'}</button>
              {searchPrefs.onlyApplyable && hiddenUsOnly > 0 && (
                <span style={{ fontSize: 12, color: '#64748b' }}>{hiddenUsOnly} US-only hidden</span>
              )}
            </div>

            {matching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '12px 16px', marginBottom: 12, fontSize: 13, color: '#4f46e5', fontWeight: 600 }}>
                <span style={{ width: 14, height: 14, border: '2px solid #c7d2fe', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                Smart match running — batch {matchProgress}. Scores appear on each job as they finish; the list re-sorts by best fit when done.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pageJobs.map((job, i) => {
                const idx = (page - 1) * JOBS_PER_PAGE + i
                const open = expandedJob === idx
                return (
                <div key={idx} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 14, background: '#fff' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{job.title}</div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{job.company} · <span style={{ textTransform: 'capitalize' }}>{job.source}</span></div>
                  {typeof job.score === 'number' && <ScoreBadge score={job.score} reason={job.reason} />}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <EligibilityBadge aiEligible={job.aiEligible} aiEligReason={job.aiEligReason} eligibility={job.eligibility} />
                    {[job.remoteType, job.location, job.salaryText].filter(Boolean).map((tag, k) => (
                      <span key={k} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'rgba(0,0,0,0.06)', color: '#334155' }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    <button onClick={() => onCreateCV(job)} style={primaryBtnStyle}>Create tailored CV →</button>
                    <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ padding: '9px 14px', borderRadius: 10, background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Open &amp; Apply →</a>
                    <button onClick={() => setExpandedJob(open ? null : idx)} style={{ padding: '9px 14px', borderRadius: 10, background: 'transparent', color: '#4f46e5', border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{open ? 'Hide details' : 'Details'}</button>
                    <button onClick={() => markJob(job, 'saved')} style={statusBtn(statusOf(job) === 'saved')}>{statusOf(job) === 'saved' ? '★ Saved' : '☆ Save'}</button>
                    <button onClick={() => markJob(job, 'applied')} style={statusBtn(statusOf(job) === 'applied')}>{statusOf(job) === 'applied' ? '✓ Applied' : 'Mark applied'}</button>
                    <button onClick={() => markJob(job, 'hidden')} title="Can't apply to this one? Hide it so it stops showing up." style={{ ...statusBtn(statusOf(job) === 'hidden'), marginLeft: 'auto', color: statusOf(job) === 'hidden' ? '#4f46e5' : '#b91c1c', borderColor: statusOf(job) === 'hidden' ? '#4f46e5' : '#fecaca' }}>{statusOf(job) === 'hidden' ? '↩ Unhide' : "🚫 Can't apply"}</button>
                  </div>
                  {open && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eef2f7', fontSize: 13, color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto' }}>
                      {job.description ? String(job.description).slice(0, 4000) : 'No description provided.'}
                    </div>
                  )}
                </div>
                )
              })}
              {!jobsLoading && !jobsError && jobsList.length === 0 && (
                <p style={{ color: '#64748b' }}>No jobs loaded yet — hit Refresh.</p>
              )}
            </div>

            {viewed.length > JOBS_PER_PAGE && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
                <button onClick={() => { setJobsPage(Math.max(1, page - 1)); setExpandedJob(null) }} disabled={page === 1} style={pagerBtn(false)}>‹ Prev</button>
                {Array.from({ length: totalPages }).map((_, n) => (
                  <button key={n} onClick={() => { setJobsPage(n + 1); setExpandedJob(null) }} style={pagerBtn(page === n + 1)}>{n + 1}</button>
                ))}
                <button onClick={() => { setJobsPage(Math.min(totalPages, page + 1)); setExpandedJob(null) }} disabled={page === totalPages} style={pagerBtn(false)}>Next ›</button>
              </div>
            )}
          </div>
          )
}
