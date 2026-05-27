import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SignVerse Mission Control',
  description: 'AI-Native Robotics OS Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
