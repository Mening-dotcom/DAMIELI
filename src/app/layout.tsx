import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cvbuilder.ai — CV Launcher',
  description: 'Cvbuilder.ai makes your resume match the role with bold, human-ready AI tailoring.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
