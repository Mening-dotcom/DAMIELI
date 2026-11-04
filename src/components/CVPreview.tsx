'use client'
// CV preview card — renders the generated CV in the chosen template style.
import React from 'react'
import { UserProfile, CVData } from '@/lib/types'

export function CVPreview({ profile, cvData, templateId, containerRef, isMobile }: { profile: UserProfile; cvData: CVData; templateId: string; containerRef?: React.Ref<HTMLDivElement>; isMobile?: boolean }) {
  const contact = [profile.email, profile.phone, profile.location, profile.linkedin, profile.portfolio].filter(Boolean)
  const isModern = templateId === 'modern' || !['ats', 'creative'].includes(templateId)
  const isAts = templateId === 'ats'
  const isCreative = templateId === 'creative'
  const accentColor = isCreative ? '#7dd3fc' : isAts ? '#2563eb' : '#0f766e'
  const containerStyle: React.CSSProperties = {
    background: isCreative ? '#0f172a' : isAts ? '#f8fafc' : '#fff',
    color: isCreative ? '#f8fafc' : '#111',
    borderRadius: 16,
    padding: isCreative ? '34px 32px' : '40px 44px',
    fontFamily: isAts ? 'Inter, sans-serif' : isCreative ? 'Montserrat, sans-serif' : 'Georgia, serif',
    lineHeight: 1.6,
    maxWidth: isMobile ? '100%' : 780,
    width: '100%',
    margin: '0 auto',
    fontSize: 14,
    overflow: 'hidden',
    boxShadow: isCreative ? '0 0 0 1px rgba(255,255,255,0.08)' : '0 0 0 1px rgba(0,0,0,0.06)',
    border: isCreative ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15, 23, 42, 0.06)',
  }
  const headingStyle: React.CSSProperties = {
    fontFamily: 'Syne, sans-serif',
    fontSize: isAts ? 24 : 26,
    fontWeight: 800,
    color: isCreative ? '#7dd3fc' : accentColor,
    marginBottom: 4,
    letterSpacing: -0.5,
  }
  const sectionHeadingProps = {
    titleStyle: {
      color: isCreative ? '#bae6fd' : isAts ? '#0f172a' : accentColor,
      borderColor: isCreative ? 'rgba(125, 211, 252, 0.3)' : isAts ? '#cbd5e1' : '#d1fae5',
      background: isModern ? 'linear-gradient(90deg, rgba(15,118,110,0.08), transparent)' : isCreative ? 'rgba(255,255,255,0.04)' : 'transparent',
      padding: isModern || isCreative ? '6px 8px' : '0 0 5px',
      borderRadius: isModern || isCreative ? 6 : undefined,
      borderLeft: isCreative ? '2px solid #7dd3fc' : undefined,
      marginBottom: 10,
    },
    itemStyle: {
      color: isCreative ? '#e2e8f0' : '#333',
      background: isAts ? '#fff' : 'transparent',
    },
  }

  const bodyContent = (
    <div>
      {isModern && <div style={{ height: 4, background: 'linear-gradient(90deg, #0f766e 0%, #34d399 100%)', borderRadius: 999, marginBottom: 16 }} />}
      <div style={headingStyle}>{profile.name}</div>
      {profile.headline && <div style={{ fontSize: 13, color: isCreative ? '#cbd5e1' : '#444', marginBottom: 6, fontStyle: 'italic' }}>{profile.headline}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 14px', fontSize: 12, color: isCreative ? '#cbd5e1' : '#555', marginBottom: isCreative ? 16 : 22 }}>
        {contact.map(c => <span key={c}>{c}</span>)}
      </div>
      {cvData.summary && <CVSection title="Professional Summary" styleOverride={sectionHeadingProps}>{<p style={{ fontSize: 13, color: sectionHeadingProps.itemStyle.color, lineHeight: 1.75, margin: 0 }}>{cvData.summary}</p>}</CVSection>}
      {cvData.experience?.length > 0 && (
        <CVSection title="Experience" styleOverride={sectionHeadingProps}>
          {cvData.experience.map((exp, i) => (
            <div key={i} style={{ marginBottom: isAts ? 14 : 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <strong style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, color: isCreative ? '#f8fafc' : '#111' }}>{exp.title}</strong>
                <span style={{ fontSize: 12, color: isCreative ? '#99a3b5' : '#777' }}>{exp.dates}</span>
              </div>
              <div style={{ fontSize: 13, color: isCreative ? '#cbd5e1' : '#444', fontStyle: 'italic', marginBottom: 6 }}>{exp.company}{exp.location ? ` — ${exp.location}` : ''}</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {exp.bullets?.map((b, j) => <li key={j} style={{ fontSize: 13, color: sectionHeadingProps.itemStyle.color, marginBottom: 3 }}>{b}</li>)}
              </ul>
            </div>
          ))}
        </CVSection>
      )}
      {cvData.education?.length > 0 && (
        <CVSection title="Education" styleOverride={sectionHeadingProps}>
          {cvData.education.map((e, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, color: isCreative ? '#f8fafc' : '#111' }}>{e.degree}</strong>
                <span style={{ fontSize: 12, color: isCreative ? '#99a3b5' : '#777' }}>{e.year}</span>
              </div>
              <div style={{ fontSize: 13, color: isCreative ? '#cbd5e1' : '#444', fontStyle: 'italic' }}>{e.school}</div>
              {e.note && <div style={{ fontSize: 12, color: sectionHeadingProps.itemStyle.color, marginTop: 3 }}>{e.note}</div>}
            </div>
          ))}
        </CVSection>
      )}
      {cvData.skills?.length > 0 && (
        <CVSection title="Skills" styleOverride={sectionHeadingProps}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cvData.skills.map(s => <span key={s} style={{ background: isCreative ? '#1e293b' : '#f3f3f3', borderRadius: 4, padding: '3px 10px', fontSize: 12, color: sectionHeadingProps.itemStyle.color }}>{s}</span>)}
          </div>
        </CVSection>
      )}
      {cvData.certifications?.length > 0 && (
        <CVSection title="Certifications" styleOverride={sectionHeadingProps}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{cvData.certifications.map((c, i) => <li key={i} style={{ fontSize: 13, color: sectionHeadingProps.itemStyle.color, marginBottom: 3 }}>{c}</li>)}</ul>
        </CVSection>
      )}
      {cvData.languages?.length > 0 && (
        <CVSection title="Languages" styleOverride={sectionHeadingProps}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cvData.languages.map(l => <span key={l} style={{ background: isCreative ? '#1e293b' : '#f3f3f3', borderRadius: 4, padding: '3px 10px', fontSize: 12, color: sectionHeadingProps.itemStyle.color }}>{l}</span>)}
          </div>
        </CVSection>
      )}
    </div>
  )

  return (
    <div ref={containerRef} style={containerStyle}>
      {isCreative ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '220px 1fr', gap: 24 }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 18, alignSelf: 'start' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#7dd3fc', marginBottom: 8 }}>{profile.name}</div>
            {profile.headline && <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 12, lineHeight: 1.5 }}>{profile.headline}</div>}
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color: '#bae6fd', marginBottom: 8 }}>Contact</div>
            <div style={{ display: 'grid', gap: 4, fontSize: 12, color: '#e2e8f0' }}>
              {contact.map(c => <span key={c}>{c}</span>)}
            </div>
            {cvData.skills?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color: '#bae6fd', marginBottom: 8 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cvData.skills.map(s => <span key={s} style={{ background: '#1e293b', borderRadius: 999, padding: '4px 8px', fontSize: 11, color: '#e2e8f0' }}>{s}</span>)}
                </div>
              </div>
            )}
          </div>
          <div>{bodyContent}</div>
        </div>
      ) : (
        bodyContent
      )}
    </div>
  )
}

function CVSection({ title, children, styleOverride }: { title: string; children: React.ReactNode; styleOverride?: { titleStyle?: React.CSSProperties; itemStyle?: React.CSSProperties } }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 10, fontFamily: 'Syne, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#666', borderBottom: '1.5px solid #e0e0e0', paddingBottom: 5, marginBottom: 12, ...(styleOverride?.titleStyle || {}) }}>{title}</div>
      {children}
    </div>
  )
}
