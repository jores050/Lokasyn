'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Home, MessageCircle, Smartphone } from 'lucide-react'

const SLIDES = [
  {
    icon: Home,
    title: 'Des milliers de logements vérifiés',
    desc: 'Chambres, studios, appartements et villas à Cotonou, Calavi et partout au Bénin.',
  },
  {
    icon: MessageCircle,
    title: 'Discutez directement, sans intermédiaire',
    desc: 'Contactez le bailleur, planifiez vos visites et négociez en toute sécurité depuis l\'app.',
  },
  {
    icon: Smartphone,
    title: 'Paiement sécurisé via Mobile Money',
    desc: 'Payez votre caution et votre loyer via MTN MoMo ou Moov Money. Vos fonds sont protégés.',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [showSplash, setShowSplash] = useState(true)
  const [current, setCurrent] = useState(0)
  const startXRef = useRef(0)

  useEffect(() => {
    const t1 = setTimeout(() => setShowSplash(false), 2000)
    return () => clearTimeout(t1)
  }, [])

  function goTo(idx: number) {
    setCurrent(Math.max(0, Math.min(SLIDES.length - 1, idx)))
  }

  function handleStart() {
    if (current < SLIDES.length - 1) {
      goTo(current + 1)
    } else {
      localStorage.setItem('lokasyn_onboarded', 'true')
      router.push('/auth')
    }
  }

  function handleExplore() {
    localStorage.setItem('lokasyn_onboarded', 'true')
    router.push('/')
  }

  if (showSplash) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">Loka<span>syn</span></div>
        <div className="splash-tagline">Trouvez, louez, gérez en toute confiance</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="onboarding-slides">
        <div
          className="onboarding-slides-track"
          style={{ transform: `translateX(-${current * 100}%)` }}
          onTouchStart={e => { startXRef.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            const diff = startXRef.current - e.changedTouches[0].clientX
            if (Math.abs(diff) > 40) goTo(diff > 0 ? current + 1 : current - 1)
          }}
        >
          {SLIDES.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="onboarding-slide">
              <div className="onboarding-slide-emoji">
                <Icon size={48} strokeWidth={1.25} />
              </div>
              <h2>{title}</h2>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="onboarding-dots">
        {SLIDES.map((_, i) => (
          <div key={i} className={`onboarding-dot${i === current ? ' active' : ''}`} />
        ))}
      </div>

      <div className="onboarding-footer">
        <button className="btn btn-primary btn-full" onClick={handleStart}>
          {current < SLIDES.length - 1 ? 'Suivant' : 'Commencer'}
        </button>
        <button className="btn btn-ghost btn-full" style={{ color: 'var(--ink-mid)' }} onClick={handleExplore}>
          Explorer sans compte
        </button>
      </div>
    </div>
  )
}
