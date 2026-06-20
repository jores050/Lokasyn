// ================================================================
// LocaSyn — solde.js
// Solde bailleur + demandes de retrait
// ================================================================

import supabase from '../supabase.js';
import { formatFCFA, formatDateShort, showToast } from '../utils.js';
import { getCurrentUser } from '../auth.js';

const TYPE_LABELS = {
  credit_visite:    { label: 'Visite confirmée',    icon: 'calendar-check', color: 'var(--green)' },
  credit_loyer:     { label: 'Loyer reçu',          icon: 'wallet',         color: 'var(--green)' },
  credit_caution:   { label: 'Caution reçue',       icon: 'lock',           color: 'var(--green)' },
  retrait:          { label: 'Retrait',              icon: 'arrow-up-right', color: 'var(--red)'   },
  ajustement_admin: { label: 'Ajustement admin',    icon: 'settings',       color: 'var(--ink-mid)'},
};

const STATUT_RETRAIT = {
  en_attente: { label: 'En attente',  cls: 'badge-amber' },
  en_cours:   { label: 'En cours',    cls: 'badge-ink'   },
  effectue:   { label: 'Effectué',    cls: 'badge-green' },
  rejete:     { label: 'Rejeté',      cls: 'badge-red'   },
};

export async function init() {
  const root = document.getElementById('solde-root');
  if (!root) return;

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  await chargerSolde(user, root);

  window.fermerModaleRetrait = () => {
    document.getElementById('retrait-modal')?.classList.remove('show');
  };

  window.soumettreRetrait = async () => {
    const montant = parseInt(document.getElementById('retrait-montant')?.value);
    const telephone = document.getElementById('retrait-telephone')?.value?.trim();
    const moyen = document.querySelector('input[name="moyenRetrait"]:checked')?.value;

    if (!montant || montant < 500) { showToast('Montant minimum : 500 FCFA', 'error'); return; }
    if (!telephone) { showToast('Numéro de réception requis', 'error'); return; }
    if (!moyen) { showToast('Choisissez un moyen de paiement', 'error'); return; }

    const { data: solde } = await supabase.from('soldes').select('montant_disponible').eq('utilisateur_id', user.id).maybeSingle();
    if (!solde || montant > solde.montant_disponible) {
      showToast('Montant supérieur à votre solde disponible', 'error');
      return;
    }

    const btn = document.querySelector('#retrait-modal .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi...'; }

    const { error } = await supabase.from('retraits').insert({
      utilisateur_id: user.id,
      montant,
      telephone_reception: telephone,
      moyen_paiement: moyen,
      statut: 'en_attente',
    });

    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send" class="icon icon--sm"></i> Envoyer la demande'; if (window.renderIcons) window.renderIcons(); }

    if (error) { showToast('Erreur lors de la demande : ' + error.message, 'error'); return; }

    document.getElementById('retrait-modal')?.classList.remove('show');
    showToast('Demande de retrait envoyée — traitement sous 24-48h ✓', 'success');
    await chargerSolde(user, root);
  };
}

async function chargerSolde(user, root) {
  const [
    { data: solde },
    { data: mouvements },
    { data: retraits },
  ] = await Promise.all([
    supabase.from('soldes').select('*').eq('utilisateur_id', user.id).maybeSingle(),
    supabase.from('mouvements_solde').select('*').eq('utilisateur_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('retraits').select('*').eq('utilisateur_id', user.id).order('created_at', { ascending: false }).limit(10),
  ]);

  const disponible = solde?.montant_disponible ?? 0;
  const totalRecu = solde?.montant_total_recu ?? 0;
  const totalRetire = solde?.montant_total_retire ?? 0;

  root.innerHTML = `
    <!-- Carte solde -->
    <div class="solde-hero">
      <div class="solde-hero-label">Solde disponible</div>
      <div class="solde-hero-montant">${formatFCFA(disponible)}</div>
      <div class="solde-hero-sub">
        <span><i data-lucide="trending-up" class="icon icon--sm"></i> ${formatFCFA(totalRecu)} reçus au total</span>
        <span><i data-lucide="trending-down" class="icon icon--sm"></i> ${formatFCFA(totalRetire)} retirés</span>
      </div>
    </div>

    <div style="padding:0 16px">
      <button class="btn btn-primary w-full" onclick="ouvrirModaleRetrait()" ${disponible <= 0 ? 'disabled style="opacity:0.5"' : ''}>
        <i data-lucide="arrow-up-right" class="icon icon--sm"></i> Demander un retrait
      </button>
      ${disponible <= 0 ? '<p style="font-size:0.8125rem;color:var(--ink-light);text-align:center;margin-top:8px">Confirmez des visites pour accumuler un solde</p>' : ''}
    </div>

    <!-- Mouvements -->
    <div class="section-header" style="margin-top:24px">
      <div class="section-title">Historique des mouvements</div>
    </div>
    ${mouvements?.length ? `
      <div style="padding:0 16px;display:flex;flex-direction:column;gap:2px">
        ${mouvements.map(m => {
          const t = TYPE_LABELS[m.type] || { label: m.type, icon: 'circle', color: 'var(--ink)' };
          const isCredit = m.montant > 0;
          return `
            <div class="list-item">
              <div style="width:36px;height:36px;border-radius:50%;background:${isCredit ? 'var(--color-green-tint, #e6f4ea)' : 'rgba(220,38,38,0.1)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i data-lucide="${t.icon}" class="icon icon--sm" style="color:${t.color}"></i>
              </div>
              <div class="list-item-content">
                <div class="list-item-title">${t.label}</div>
                <div class="list-item-subtitle">${m.description || ''} · ${formatDateShort(m.created_at)}</div>
              </div>
              <div style="font-weight:700;color:${isCredit ? 'var(--green)' : 'var(--red)'}">
                ${isCredit ? '+' : ''}${formatFCFA(m.montant)}
              </div>
            </div>`;
        }).join('')}
      </div>` : `
      <div style="padding:16px;text-align:center;color:var(--ink-light);font-size:0.875rem">
        Aucun mouvement pour l'instant
      </div>`
    }

    <!-- Retraits -->
    <div class="section-header" style="margin-top:8px">
      <div class="section-title">Mes demandes de retrait</div>
    </div>
    ${retraits?.length ? `
      <div style="padding:0 16px;display:flex;flex-direction:column;gap:2px;margin-bottom:32px">
        ${retraits.map(r => {
          const s = STATUT_RETRAIT[r.statut] || { label: r.statut, cls: 'badge-ink' };
          const moyenLabel = r.moyen_paiement === 'mtn_momo' ? 'MTN MoMo' : 'Moov Money';
          return `
            <div class="list-item">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--sand-dark);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i data-lucide="wallet" class="icon icon--sm"></i>
              </div>
              <div class="list-item-content">
                <div class="list-item-title">${formatFCFA(r.montant)} → ${moyenLabel}</div>
                <div class="list-item-subtitle">${r.telephone_reception} · ${formatDateShort(r.created_at)}</div>
              </div>
              <span class="badge ${s.cls}">${s.label}</span>
            </div>`;
        }).join('')}
      </div>` : `
      <div style="padding:16px;text-align:center;color:var(--ink-light);font-size:0.875rem;margin-bottom:32px">
        Aucune demande de retrait
      </div>`
    }
  `;

  if (window.renderIcons) window.renderIcons();

  window.ouvrirModaleRetrait = () => {
    const dispEl = document.getElementById('retrait-solde-dispo');
    if (dispEl) dispEl.textContent = formatFCFA(disponible);
    document.getElementById('retrait-montant').value = '';
    document.getElementById('retrait-telephone').value = '';
    document.querySelectorAll('input[name="moyenRetrait"]').forEach(r => r.checked = false);
    document.getElementById('retrait-modal')?.classList.add('show');
  };
}
