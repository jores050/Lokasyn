'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function AttenteEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const shouldResend = searchParams.get('resend') === 'true'

  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function resend() {
    if (!email) return
    setSending(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.resend({ type: 'signup', email })
    setSending(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  // Si resend=true dans l'URL (lien expiré), renvoyer automatiquement au montage
  useEffect(() => {
    if (shouldResend && email) { resend() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="auth-screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div className="auth-logo" style={{ marginBottom: 8 }}>Loka<span>syn</span></div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '0 24px', maxWidth: 380, margin: '24px auto 0' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--color-green-tint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MailCheck size={36} color="var(--color-green)" strokeWidth={1.5} />
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', color: 'var(--color-ink)', margin: 0 }}>
          Vérifiez votre email
        </h2>

        <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
          Un lien de confirmation a été envoyé à{' '}
          {email ? <strong style={{ color: 'var(--color-ink)' }}>{email}</strong> : 'votre adresse email'}.
          {' '}Cliquez dessus pour activer votre compte.
        </p>

        <p style={{ color: 'var(--color-ink-faint)', fontSize: '0.8rem', margin: 0 }}>
          Pensez à vérifier vos spams si vous ne le trouvez pas.
        </p>

        {sent && (
          <div style={{
            background: 'var(--color-green-tint)',
            border: '1px solid var(--color-green)',
            borderRadius: 'var(--radius-xs)',
            padding: '10px 16px',
            fontSize: '0.875rem',
            color: 'var(--color-green)',
            width: '100%',
          }}>
            Email renvoyé avec succès !
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(239, 83, 80, 0.08)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-xs)',
            padding: '10px 16px',
            fontSize: '0.875rem',
            color: 'var(--color-error)',
            width: '100%',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={resend}
          disabled={sending || !email}
          className="btn btn-primary btn-full"
          style={{ marginTop: 8 }}
        >
          {sending ? 'Envoi en cours…' : sent ? 'Renvoyer à nouveau' : 'Renvoyer l\'email'}
        </button>

        <button
          onClick={() => router.push('/')}
          className="btn btn-full"
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border)',
            color: 'var(--color-ink-soft)',
          }}
        >
          Retour à l&apos;accueil
        </button>
      </div>
    </div>
  )
}

export default function AttenteEmailPage() {
  return (
    <Suspense>
      <AttenteEmailContent />
    </Suspense>
  )
}
