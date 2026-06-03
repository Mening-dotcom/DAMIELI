import { CVData, UserProfile } from './types'

export interface CVTemplate {
  id: string
  name: string
  description: string
  category: 'modern' | 'ats' | 'creative'
}

const modernTemplate: CVTemplate = {
  id: 'modern',
  name: 'Modern',
  description: 'Clean and ATS-optimized. Perfect for tech roles.',
  category: 'modern',
}

const atsTemplate: CVTemplate = {
  id: 'ats',
  name: 'ATS-Optimized',
  description: 'Maximizes ATS parsing. Straightforward formatting for applicant tracking systems.',
  category: 'ats',
}

const creativeTemplate: CVTemplate = {
  id: 'creative',
  name: 'Creative',
  description: 'Visually engaging. Great for creative, marketing, or design roles.',
  category: 'creative',
}

export const CV_TEMPLATES: CVTemplate[] = [modernTemplate, atsTemplate, creativeTemplate]

export function getTemplate(id: string): CVTemplate | undefined {
  return CV_TEMPLATES.find(t => t.id === id)
}

const join = (items?: string[], separator = ', ') => (items && items.length ? items.join(separator) : '')
const block = (lines: (string | undefined)[]) => lines.filter(Boolean).join('\n')

const renderExperience = (experience: CVData['experience']) => {
  if (!experience?.length) return ''
  return ['EXPERIENCE', ...experience.map(item => {
    const header = `${item.title} | ${item.company}${item.location ? ` — ${item.location}` : ''}`.trim()
    const bullets = item.bullets?.filter(Boolean).map(b => `• ${b}`) || []
    return block([header, item.dates, ...bullets])
  })].join('\n\n')
}

const renderEducation = (education: CVData['education']) => {
  if (!education?.length) return ''
  return ['EDUCATION', ...education.map(item => block([`${item.degree} | ${item.school}`, item.year, item.note]))].join('\n\n')
}

const renderListSection = (title: string, items: string[], separator = ', ') => {
  if (!items?.length) return ''
  return `${title}\n${join(items, separator)}`
}

const renderModern = (profile: UserProfile, cvData: CVData) => {
  const header = block([
    profile.name,
    [profile.email, profile.phone, profile.location, profile.linkedin].filter(Boolean).join(' | '),
  ])

  const sections = [
    header,
    cvData.summary ? block(['PROFESSIONAL SUMMARY', cvData.summary]) : '',
    renderExperience(cvData.experience),
    renderEducation(cvData.education),
    renderListSection('SKILLS', cvData.skills),
    renderListSection('CERTIFICATIONS', cvData.certifications, '\n'),
    renderListSection('LANGUAGES', cvData.languages, ' | '),
  ]

  return sections.filter(Boolean).join('\n\n')
}

const renderATS = (profile: UserProfile, cvData: CVData) => {
  const contact = block([
    'CONTACT INFORMATION',
    `Email: ${profile.email}`,
    profile.phone ? `Phone: ${profile.phone}` : '',
    profile.location ? `Location: ${profile.location}` : '',
    profile.linkedin ? `LinkedIn: ${profile.linkedin}` : '',
  ])

  const sections = [
    profile.name,
    contact,
    cvData.summary ? block(['PROFESSIONAL SUMMARY', cvData.summary]) : '',
    cvData.experience?.length ? block(['PROFESSIONAL EXPERIENCE', ...cvData.experience.map(item => {
      const details = [item.title, item.company]
      if (item.location) details.push(`Location: ${item.location}`)
      details.push(item.dates)
      const bullets = item.bullets?.filter(Boolean).map(b => `• ${b}`) || []
      return block([...details, ...bullets])
    })]) : '',
    cvData.education?.length ? block(['EDUCATION', ...cvData.education.map(item => block([item.degree, `School: ${item.school}`, `Year: ${item.year}`, item.note ? `Additional Information: ${item.note}` : '']))]) : '',
    renderListSection('SKILLS', cvData.skills),
    renderListSection('CERTIFICATIONS', cvData.certifications, '\n'),
    cvData.languages?.length ? block(['LANGUAGES', ...cvData.languages.map(item => `• ${item}`)]) : '',
  ]

  return sections.filter(Boolean).join('\n\n')
}

const renderCreative = (profile: UserProfile, cvData: CVData) => {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════════',
    `  ${profile.name}`,
    '═══════════════════════════════════════════════════════════════════',
    [profile.email, profile.phone, profile.location, profile.linkedin].filter(Boolean).join(' • '),
  ]

  if (cvData.summary) {
    lines.push('█ ABOUT', cvData.summary)
  }

  if (cvData.experience?.length) {
    lines.push('█ EXPERIENCE', ...cvData.experience.map(item => {
      const header = `⬤ ${item.title} | ${item.company}`
      const detail = `${item.dates}${item.location ? ` • ${item.location}` : ''}`.trim()
      const bullets = item.bullets?.filter(Boolean).map(b => `- ${b}`) || []
      return block([header, detail, ...bullets])
    }))
  }

  if (cvData.education?.length) {
    lines.push('█ EDUCATION', ...cvData.education.map(item => block([`⬤ ${item.degree} • ${item.school} (${item.year})`, item.note || ''])))
  }

  if (cvData.skills?.length) {
    lines.push('█ KEY SKILLS', join(cvData.skills, ' • '))
  }

  if (cvData.certifications?.length) {
    lines.push('█ CERTIFICATIONS', ...cvData.certifications.map(item => `• ${item}`))
  }

  if (cvData.languages?.length) {
    lines.push('█ LANGUAGES', join(cvData.languages, ' • '))
  }

  lines.push('═══════════════════════════════════════════════════════════════════')
  return lines.filter(Boolean).join('\n\n')
}

export function renderCV(profile: UserProfile, cvData: CVData, templateId: string = 'modern'): string {
  switch (templateId) {
    case 'ats':
      return renderATS(profile, cvData)
    case 'creative':
      return renderCreative(profile, cvData)
    default:
      return renderModern(profile, cvData)
  }
}

export default { CV_TEMPLATES, getTemplate, renderCV }
