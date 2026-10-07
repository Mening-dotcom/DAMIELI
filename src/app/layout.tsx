import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cvbuilder.ai — CV Launcher',
  description: 'Cvbuilder.ai makes your resume match the role with bold, human-ready AI tailoring.',
}

// Without this, phones/iPads render the page at ~980px desktop width, so the
// mobile layout never kicks in (sidebar stays stuck, content overflows).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
