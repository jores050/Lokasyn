import type { Metadata } from 'next'
import { Lora, Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { ServiceWorkerRegistrar } from '@/components/layout/ServiceWorkerRegistrar'
import { ThemeProvider } from '@/components/layout/ThemeProvider'

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-display',
  display: 'swap',
})
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LokaSyn — Logements au Bénin',
  description: 'Trouvez votre logement idéal à Cotonou, Calavi et partout au Bénin',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${lora.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* No-FOUC : applique le thème avant le premier paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lokasyn-theme');if(!t){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        {/* iOS PWA — barre système adaptée au thème */}
        <meta name="theme-color" content="#0F5132" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0D1F17" media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  )
}
