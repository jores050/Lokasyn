'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const code       = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type       = searchParams.get('type') ?? 'email'

    async function verify() {
      const supabase = createClient()

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          setStatus('success')
          setTimeout(() => router.push('/profile'), 1500)
          return
        }
      }

      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change',
        })
        if (!error) {
          setStatus('success')
          setTimeout(() => router.push('/profile'), 1500)
          return
        }
      }

      setStatus('error')
      setTimeout(() => router.push('/auth?error=invalid_token'), 2500)
    }

    verify()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            Redirection vers votre profil…
          </p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 52 }}>❌</div>
          <h3 style={{ marginTop: 16, fontFamily: 'var(--font-display)' }}>Lien invalide</h3>
          <p style={{ color: 'var(--color-ink-soft)', marginTop: 8, fontSize: '0.9rem' }}>
            Ce lien a expiré ou est incorrect.
          </p>
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
