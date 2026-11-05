// CV export helpers — PDF (jsPDF) and Word (docx) download builders.
// Plain functions, no React: they take data and produce a file.
import { UserProfile, CVData } from '@/lib/types'

export const resolveTemplateId = (value?: string) => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'ats' || normalized === 'creative' || normalized === 'modern') return normalized
  return 'modern'
}

// ─── PDF export that stays readable and reflects the chosen CV style ─────
export async function downloadPDF(profile: UserProfile, cvData: CVData, role: string, previewNode?: HTMLDivElement | null, templateId = 'modern') {
  try {
    const { jsPDF } = await import('jspdf')
    const normalizedTemplateId = resolveTemplateId(templateId)

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210, M = 15, TW = W - M * 2
    const pageHeight = doc.internal.pageSize.getHeight()
    const maxY = pageHeight - 15
    let y = 15

    const isAts = normalizedTemplateId === 'ats'
    const isCreative = normalizedTemplateId === 'creative'
    const accentColor = isCreative ? '#2563eb' : isAts ? '#1d4ed8' : '#0f766e'
    const titleColor = isCreative ? '#7dd3fc' : isAts ? '#0f172a' : '#111111'
    const bodyColor = isCreative ? '#e2e8f0' : '#333333'

    const ensureSpace = (neededSpace: number) => {
      if (y + neededSpace > maxY) {
        doc.addPage()
        y = 15
      }
    }

    const line = (text: string, size: number, bold = false, color = '#111111', indent = 0) => {
      if (!text) return
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(color)
      const width = TW - indent
      const wrapped = doc.splitTextToSize(text, width) as string[]
      wrapped.forEach((l: string) => {
        ensureSpace(size * 0.52 + 1)
        doc.text(l, M + indent, y)
        y += size * 0.52 + 0.35
      })
      y += 0.5
    }

    const section = (title: string, compact = false) => {
      ensureSpace(10)
      y += compact ? 0 : 2
      doc.setFontSize(compact ? 8 : 8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(isCreative ? '#bae6fd' : isAts ? '#0f172a' : '#444444')
      doc.text(title.toUpperCase(), M, y)
      y += compact ? 2.2 : 2.2
      doc.setDrawColor(isCreative ? '#60a5fa' : '#e5e7eb')
      doc.setLineWidth(isCreative ? 0.35 : 0.2)
      doc.line(M, y, M + TW, y)
      y += 3.2
    }

    if (profile?.name) {
      doc.setFontSize(isCreative ? 18 : isAts ? 16 : 18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(titleColor)
      doc.text(profile.name, M, y)
      y += 5.2
    }

    const contact = [profile?.email, profile?.phone, profile?.location, profile?.linkedin].filter(Boolean).join('  |   ')
    if (contact) line(contact, isCreative ? 7.2 : isAts ? 7 : 7.5, false, isCreative ? '#cbd5e1' : '#555555')
    y += 1

    if (isCreative) {
      doc.setDrawColor(accentColor)
      doc.setLineWidth(0.7)
      doc.line(M, y, M + TW * 0.55, y)
      y += 2.6
      section('Profile Snapshot', true)
      line(profile?.headline || 'Creative-focused profile', 8.8, false, '#cbd5e1')
      if (cvData?.summary) line(cvData.summary, 8.3, false, bodyColor)
    } else if (isAts) {
      section('Contact Information', true)
      line(`Email: ${profile?.email || ''}`, 8.2, false, '#333333')
      if (profile?.phone) line(`Phone: ${profile.phone}`, 8.2, false, '#333333')
      if (profile?.location) line(`Location: ${profile.location}`, 8.2, false, '#333333')
      if (profile?.linkedin) line(`LinkedIn: ${profile.linkedin}`, 8.2, false, '#333333')
      if (cvData?.summary) {
        section('Professional Summary', true)
        line(cvData.summary, 8.5, false, bodyColor)
      }
    } else if (cvData?.summary) {
      section('Professional Summary', isAts)
      line(cvData.summary, 8.8, false, bodyColor)
    }

    if (cvData?.experience && Array.isArray(cvData.experience)) {
      section('Experience', isAts)
      cvData.experience.forEach((exp) => {
        if (!exp) return
        ensureSpace(12)

        doc.setFontSize(9.2)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(titleColor)
        doc.text(exp.title || 'Position', M, y)
        doc.setFontSize(7.6)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#666666')
        doc.text(exp.dates || '', W - M, y, { align: 'right' })
        y += 3.6

        doc.setFontSize(8.6)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(bodyColor)
        doc.text((exp.company || '') + (exp.location ? ` — ${exp.location}` : ''), M, y)
        y += 3.6

        if (exp.bullets && Array.isArray(exp.bullets)) {
          exp.bullets.forEach((b: string) => {
            if (!b) return
            line(`• ${b}`, 8.2, false, bodyColor, isCreative ? 2 : 2)
          })
        }
        y += 1
      })
    }

    if (cvData?.education && Array.isArray(cvData.education)) {
      section('Education', isAts)
      cvData.education.forEach((e) => {
        if (!e) return
        ensureSpace(10)
        doc.setFontSize(9.2)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(titleColor)
        doc.text(e.degree || 'Degree', M, y)
        doc.setFontSize(7.6)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor('#666666')
        doc.text(e.year || '', W - M, y, { align: 'right' })
        y += 3.6
        doc.setFontSize(8.4)
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(bodyColor)
        doc.text(e.school || '', M, y)
        y += 3.6
        if (e.note) line(e.note, 7.8, false, isCreative ? '#cbd5e1' : '#555555')
        y += 0.8
      })
    }

    if (cvData?.skills && Array.isArray(cvData.skills) && cvData.skills.length > 0) {
      section('Skills', isAts)
      line(cvData.skills.join('  •  '), 8.2, false, bodyColor)
    }

    if (cvData?.certifications && Array.isArray(cvData.certifications) && cvData.certifications.length > 0) {
      section('Certifications', isAts)
      line(cvData.certifications.join('  •  '), 8.2, false, bodyColor)
    }

    if (cvData?.languages && Array.isArray(cvData.languages) && cvData.languages.length > 0) {
      section('Languages', isAts)
      line(cvData.languages.join('  |   '), 8.2, false, bodyColor)
    }

    doc.save(`${(profile?.name || 'CV').replace(/ /g, '_')}_${(templateId || 'modern').toUpperCase()}_CV.pdf`)
  } catch (error) {
    console.error('PDF Generation crashed:', error)
  }
}

export async function downloadWord(profile: UserProfile, cvData: CVData, role: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } = await import('docx')

  const contact = [profile.email, profile.phone, profile.location, profile.linkedin].filter(Boolean).join('  |  ')

  const sectionHeading = (text: string) => new Paragraph({
    text: text.toUpperCase(),
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 100 },
    border: { bottom: { color: 'DDDDDD', style: BorderStyle.SINGLE, size: 6 } },
    run: { font: 'Calibri', size: 18, bold: true, color: '555555' },
  })

  const children: any[] = [
    new Paragraph({
      children: [new TextRun({ text: profile.name, bold: true, size: 44, font: 'Calibri' })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
    }),
    ...(contact ? [new Paragraph({ children: [new TextRun({ text: contact, size: 18, color: '555555', font: 'Calibri' })], spacing: { after: 200 } })] : []),
  ]

  if (cvData.summary) {
    children.push(sectionHeading('Professional Summary'))
    children.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 20, font: 'Calibri' })], spacing: { after: 200 } }))
  }

  if (cvData.experience?.length) {
    children.push(sectionHeading('Experience'))
    cvData.experience.forEach(exp => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: exp.title, bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `  ${exp.dates || ''}`, size: 18, color: '777777', font: 'Calibri' }),
        ],
        spacing: { before: 200, after: 60 },
      }))
      children.push(new Paragraph({ children: [new TextRun({ text: exp.company + (exp.location ? ` — ${exp.location}` : ''), italics: true, size: 20, color: '444444', font: 'Calibri' })], spacing: { after: 100 } }))
      exp.bullets?.forEach(b => {
        children.push(new Paragraph({ children: [new TextRun({ text: b, size: 20, font: 'Calibri' })], bullet: { level: 0 }, spacing: { after: 60 } }))
      })
    })
  }

  if (cvData.education?.length) {
    children.push(sectionHeading('Education'))
    cvData.education.forEach(e => {
      children.push(new Paragraph({ children: [new TextRun({ text: e.degree, bold: true, size: 22, font: 'Calibri' }), new TextRun({ text: `  ${e.year || ''}`, size: 18, color: '777777', font: 'Calibri' })], spacing: { before: 200, after: 60 } }))
      children.push(new Paragraph({ children: [new TextRun({ text: e.school, italics: true, size: 20, color: '444444', font: 'Calibri' })], spacing: { after: e.note ? 60 : 120 } }))
      if (e.note) children.push(new Paragraph({ children: [new TextRun({ text: e.note, size: 18, color: '555555', font: 'Calibri' })], spacing: { after: 120 } }))
    })
  }

  if (cvData.skills?.length) {
    children.push(sectionHeading('Skills'))
    children.push(new Paragraph({ children: [new TextRun({ text: cvData.skills.join(' • '), size: 20, font: 'Calibri' })], spacing: { after: 200 } }))
  }

  if (cvData.certifications?.length) {
    children.push(sectionHeading('Certifications'))
    cvData.certifications.forEach(c => children.push(new Paragraph({ children: [new TextRun({ text: c, size: 20, font: 'Calibri' })], bullet: { level: 0 }, spacing: { after: 60 } })))
  }

  if (cvData.languages?.length) {
    children.push(sectionHeading('Languages'))
    children.push(new Paragraph({ children: [new TextRun({ text: cvData.languages.join('  |  '), size: 20, font: 'Calibri' })], spacing: { after: 200 } }))
  }

  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }] })
  const buffer = await Packer.toBlob(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(buffer)
  a.download = `${profile.name.replace(/ /g, '_')}_CV_${role.replace(/ /g, '_')}.docx`
  a.click()
}
