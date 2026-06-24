import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { ServiceWorkerRegistrar } from '@/components/layout/ServiceWorkerRegistrar'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'LokaSyn — Logements au Bénin',
  description: 'Trouvez votre logement idéal à Cotonou, Calavi et partout au Bénin',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${inter.variable}`}>
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
          <ServiceWorkerRegistrar />
        </AuthProvider>
      </body>
    </html>
  )
}
