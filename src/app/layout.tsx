import type { Metadata } from 'next'
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { OfflineBanner } from '@/components/layout/OfflineBanner'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'LokaSyn — Logements au Bénin',
  description: 'Trouvez votre logement idéal à Cotonou, Calavi et partout au Bénin',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AuthProvider>
          <div id="app-wrapper">
            <Sidebar />
            <div id="app">
              {children}
            </div>
            <BottomNav />
          </div>
          <ToastProvider />
          <OfflineBanner />
        </AuthProvider>
      </body>
    </html>
  )
}
