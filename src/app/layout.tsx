import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Nascente Contábil — Portal Enterprise',
    template: '%s | Nascente Contábil',
  },
  description: 'Portal unificado de gestão contábil e tarefas.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
