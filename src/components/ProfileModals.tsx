'use client'
import React from 'react'
import { UserProfile, Job, Education, Certification, Language } from '@/lib/types'
import { uid } from '@/lib/state'
import { Modal, Field, Input, inputStyle, textareaStyle } from './ui'

export function ProfileModals({ modal, setModal, editIdx, profile, updateProfile, jobForm, setJobForm, eduForm, setEduForm, certForm, setCertForm, langForm, setLangForm }: {
  modal: string | null
  setModal: (m: string | null) => void
  editIdx: number | null
  profile: UserProfile
  updateProfile: (p: Partial<UserProfile>) => void
  jobForm: Partial<Job>
  setJobForm: React.Dispatch<React.SetStateAction<Partial<Job>>>
  eduForm: Partial<Education>
  setEduForm: React.Dispatch<React.SetStateAction<Partial<Education>>>
  certForm: Partial<Certification>
  setCertForm: React.Dispatch<React.SetStateAction<Partial<Certification>>>
  langForm: Partial<Language>
  setLangForm: React.Dispatch<React.SetStateAction<Partial<Language>>>
}) {
  return (
    <>
      {modal === 'job' && (
        <Modal title={editIdx !== null ? 'Edit position' : 'Add work experience'} onClose={() => setModal(null)}
          onSave={() => {
            if (!jobForm.title) return
            const entry: Job = { id: uid(), title: jobForm.title || '', company: jobForm.company || '', start: jobForm.start || '', end: jobForm.end || '', location: jobForm.location || '', description: jobForm.description || '', technologies: jobForm.technologies || '' }
            const jobs = [...profile.jobs]
            if (editIdx !== null) jobs[editIdx] = entry; else jobs.unshift(entry)
            updateProfile({ jobs }); setModal(null)
          }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Job title"><Input value={jobForm.title || ''} onChange={v => setJobForm(f => ({ ...f, title: v }))} placeholder="Software Engineer" /></Field>
            <Field label="Company"><Input value={jobForm.company || ''} onChange={v => setJobForm(f => ({ ...f, company: v }))} placeholder="Acme Corp" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Field label="Start"><Input value={jobForm.start || ''} onChange={v => setJobForm(f => ({ ...f, start: v }))} placeholder="Jan 2021" /></Field>
            <Field label="End"><Input value={jobForm.end || ''} onChange={v => setJobForm(f => ({ ...f, end: v }))} placeholder="Present" /></Field>
            <Field label="Location"><Input value={jobForm.location || ''} onChange={v => setJobForm(f => ({ ...f, location: v }))} placeholder="Remote" /></Field>
          </div>
          <Field label="Description & achievements — be specific, include numbers and results">
            <textarea value={jobForm.description || ''} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} rows={5} placeholder="- Led migration from monolith to microservices, reducing deploy time by 60%&#10;- Managed team of 5 engineers&#10;- Built CI/CD pipeline, cut production bugs by 40%" style={textareaStyle} />
          </Field>
          <Field label="Technologies / tools used">
            <Input value={jobForm.technologies || ''} onChange={v => setJobForm(f => ({ ...f, technologies: v }))} placeholder="React, Node.js, PostgreSQL, AWS, Docker" />
          </Field>
        </Modal>
      )}

      {modal === 'edu' && (
        <Modal title={editIdx !== null ? 'Edit education' : 'Add education'} onClose={() => setModal(null)}
          onSave={() => {
            if (!eduForm.degree) return
            const entry: Education = { id: uid(), degree: eduForm.degree || '', school: eduForm.school || '', startYear: eduForm.startYear || '', endYear: eduForm.endYear || '', notes: eduForm.notes || '' }
            const education = [...profile.education]
            if (editIdx !== null) education[editIdx] = entry; else education.push(entry)
            updateProfile({ education }); setModal(null)
          }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Degree / qualification"><Input value={eduForm.degree || ''} onChange={v => setEduForm(f => ({ ...f, degree: v }))} placeholder="BSc Computer Science" /></Field>
            <Field label="Institution"><Input value={eduForm.school || ''} onChange={v => setEduForm(f => ({ ...f, school: v }))} placeholder="University of..." /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Start year"><Input value={eduForm.startYear || ''} onChange={v => setEduForm(f => ({ ...f, startYear: v }))} placeholder="2018" /></Field>
            <Field label="End year"><Input value={eduForm.endYear || ''} onChange={v => setEduForm(f => ({ ...f, endYear: v }))} placeholder="2022" /></Field>
          </div>
          <Field label="Honors, GPA, thesis, notable coursework (optional)">
            <textarea value={eduForm.notes || ''} onChange={e => setEduForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="GPA 3.8, Dean's list, Thesis: ..." style={textareaStyle} />
          </Field>
        </Modal>
      )}

      {modal === 'cert' && (
        <Modal title="Add certification / course" onClose={() => setModal(null)}
          onSave={() => {
            if (!certForm.name) return
            const entry: Certification = { id: uid(), name: certForm.name || '', issuer: certForm.issuer || '', date: certForm.date || '', credentialId: certForm.credentialId || '' }
            const certifications = [...profile.certifications]
            if (editIdx !== null) certifications[editIdx] = entry; else certifications.push(entry)
            updateProfile({ certifications }); setModal(null)
          }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Certificate name"><Input value={certForm.name || ''} onChange={v => setCertForm(f => ({ ...f, name: v }))} placeholder="AWS Solutions Architect" /></Field>
            <Field label="Issuer / Platform"><Input value={certForm.issuer || ''} onChange={v => setCertForm(f => ({ ...f, issuer: v }))} placeholder="Amazon / Coursera / Udemy" /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Date"><Input value={certForm.date || ''} onChange={v => setCertForm(f => ({ ...f, date: v }))} placeholder="2023" /></Field>
            <Field label="Credential ID (optional)"><Input value={certForm.credentialId || ''} onChange={v => setCertForm(f => ({ ...f, credentialId: v }))} placeholder="ABC-1234" /></Field>
          </div>
        </Modal>
      )}

      {modal === 'lang' && (
        <Modal title="Add language" onClose={() => setModal(null)}
          onSave={() => {
            if (!langForm.name) return
            const entry: Language = { id: uid(), name: langForm.name || '', level: langForm.level || 'Fluent' }
            const languages = [...profile.languages]
            if (editIdx !== null) languages[editIdx] = entry; else languages.push(entry)
            updateProfile({ languages }); setModal(null)
          }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Language"><Input value={langForm.name || ''} onChange={v => setLangForm(f => ({ ...f, name: v }))} placeholder="Spanish" /></Field>
            <Field label="Level">
              <select value={langForm.level || 'Fluent'} onChange={e => setLangForm(f => ({ ...f, level: e.target.value }))} style={inputStyle}>
                {['Native', 'Fluent', 'Advanced (C1)', 'Upper-Intermediate (B2)', 'Intermediate (B1)', 'Basic (A2)'].map(l => <option key={l}>{l}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}
