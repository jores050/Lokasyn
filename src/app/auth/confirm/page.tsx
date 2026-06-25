'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/components/ui/Toast'

type Status = 'loading' | 'success' | 'expired' | 'error'

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const code       = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type       = searchParams.get('type') ?? 'email'
    const emailParam = searchParams.get('email') ?? ''
    setEmail(emailParam)

    async function verify() {
      const supabase = createClient()

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          showToast('Compte activé — bienvenue sur LocaSyn !', 'success', 5000)
          setStatus('success')
          setTimeout(() => router.push('/'), 1500)
          return
        }
        const isExpired = error.message?.toLowerCase().includes('expired') || (error as any).code === 'otp_expired'
        if (isExpired) { setStatus('expired'); return }
        setErrorMsg(error.message)
        setStatus('error')
        return
      }

      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change',
        })
        if (!error) {
          showToast('Compte activé — bienvenue sur LocaSyn !', 'success', 5000)
          setStatus('success')
          setTimeout(() => router.push('/'), 1500)
          return
        }
        const isExpired = error.message?.toLowerCase().includes('expired') || (error as any).code === 'otp_expired'
        if (isExpired) { setStatus('expired'); return }
        setErrorMsg(error.message)
        setStatus('error')
        return
      }

      setStatus('error')
      setErrorMsg('Lien de confirmation manquant.')
    }

    verify()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function goResend() {
    const params = new URLSearchParams()
    if (email) params.set('email', email)
    params.set('resend', 'true')
    router.push(`/auth/attente-email?${params.toString()}`)
  }

  return (
    <div className="auth-screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div className="auth-logo">Loka<span>syn</span></div>

      {status === 'loading' && (
        <div style={{ marginTop: 32 }}>
          <div className="skeleton" style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--color-ink-soft)' }}>Vérification en cours…</p>
        </div>
      )}

      {status === 'success' && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 52 }}>✅</div>
          <h3 style={{ marginTop: 16, fontFamily: 'var(--font-display)' }}>Email confirmé !</h3>
          <p style={{ color: 'var(--color-ink-soft)', marginTop: 8, fontSize: '0.9rem' }}>
            Redirection vers l&apos;accueil…
          </p>
        </div>
      )}

      {status === 'expired' && (
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '0 24px', maxWidth: 360, margin: '32px auto 0' }}>
          <div style={{ fontSize: 52 }}>⏰</div>
          <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Lien expiré</h3>
          <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
            Ce lien de confirmation a expiré. Les liens sont valables 24 h.
            Cliquez ci-dessous pour en recevoir un nouveau.
          </p>
          <button onClick={goResend} className="btn btn-primary btn-full">
            Recevoir un nouveau lien
          </button>
          <button onClick={() => router.push('/auth')} className="btn btn-full" style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-ink-soft)' }}>
            Retour à la connexion
          </button>
        </div>
      )}

      {status === 'error' && (
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '0 24px', maxWidth: 360, margin: '32px auto 0' }}>
          <div style={{ fontSize: 52 }}>❌</div>
          <h3 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Lien invalide</h3>
          {errorMsg && (
            <p style={{ color: 'var(--color-ink-soft)', fontSize: '0.875rem', margin: 0 }}>{errorMsg}</p>
          )}
          <button onClick={() => router.push('/auth')} className="btn btn-primary btn-full">
            Retour à la connexion
          </button>
        </div>
      )}
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  )
}
