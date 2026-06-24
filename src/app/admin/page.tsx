'use client'

import { useState } from 'react'
import { OngletModeration } from '@/components/admin/OngletModeration'
import { OngletUtilisateurs } from '@/components/admin/OngletUtilisateurs'
import { OngletPaiements } from '@/components/admin/OngletPaiements'
import { OngletStats } from '@/components/admin/OngletStats'

const ONGLETS = [
  { id: 'moderation',   label: 'Modération'   },
  { id: 'utilisateurs', label: 'Utilisateurs' },
  { id: 'paiements',    label: 'Paiements'    },
  { id: 'stats',        label: 'Statistiques' },
] as const

type OngletId = typeof ONGLETS[number]['id']

export default function AdminPage() {
  const [actif, setActif] = useState<OngletId>('moderation')

  return (
    <div className="admin-page">
      <div style={{ padding: '16px 16px 0' }}>
        <h1 className="admin-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
          Backoffice LocaSyn
        </h1>
      </div>

      <div className="admin-tabs" style={{ display: 'flex', gap: 4, padding: '12px 16px', overflowX: 'auto', borderBottom: '1px solid var(--border-light)' }}>
        {ONGLETS.map(o => (
          <button
            key={o.id}
            className={`admin-tab${actif === o.id ? ' active' : ''}`}
            onClick={() => setActif(o.id)}
            style={{
              padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: actif === o.id ? 600 : 400, whiteSpace: 'nowrap', fontSize: '0.875rem',
              background: actif === o.id ? 'var(--green)' : 'transparent',
              color: actif === o.id ? 'white' : 'var(--ink-mid)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="admin-content" style={{ padding: 16 }}>
        {actif === 'moderation'   && <OngletModeration />}
        {actif === 'utilisateurs' && <OngletUtilisateurs />}
        {actif === 'paiements'    && <OngletPaiements />}
        {actif === 'stats'        && <OngletStats />}
      </div>
    </div>
  )
}
