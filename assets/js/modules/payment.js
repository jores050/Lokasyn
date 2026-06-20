// ================================================================
// LocaSyn — payment.js
// KKiaPay integration, caution escrow, loyer mensuel
// ================================================================

import supabase from '../supabase.js';
import { formatFCFA, moisLabel, showToast } from '../utils.js';
import { getCurrentUser } from '../auth.js';

// ================================================================
// Ouvrir le widget KKiaPay
// ================================================================
function openKkiapay(amount, telephone, moyen, data, onSuccess, onError) {
  if (!window.openKkiapayWidget) {
    showToast('SDK KKiaPay non chargé. Vérifiez votre connexion.', 'error');
    return;
  }
  window.openKkiapayWidget({
    amount,
    api_key: window.__ENV?.KKIAPAY_PUBLIC_KEY || 'KKIAPAY_PUBLIC_KEY',
    callback: window.location.href,
    data: JSON.stringify(data),
    phone: telephone?.replace(/[\s\-+]/g, ''),
    name: 'LocaSyn',
    theme: '#1B6B4A',
    sandbox: true,
  });

  const handler = (event) => {
    window.removeEventListener('kkiapay-widget-event', handler);
    if (event.detail?.status === 'SUCCESS') {
      onSuccess(event.detail);
    } else {
      onError(event.detail?.reason || 'Paiement annulé');
    }
  };
  window.addEventListener('kkiapay-widget-event', handler);
}

// ================================================================
// Rendu sélecteur moyen de paiement
// ================================================================
function renderPaymentOptions() {
  return `
    <div class="payment-phone-options" id="payment-options">
      <div class="payment-option selected" data-moyen="mtn_momo" onclick="selectMoyen(this)">
        <div class="payment-option-icon"><i data-lucide="smartphone" class="icon icon--lg"></i></div>
        <div>
          <div class="payment-option-name">MTN MoMo</div>
          <div class="payment-option-desc">Paiement via MTN Mobile Money</div>
        </div>
      </div>
      <div class="payment-option" data-moyen="moov_money" onclick="selectMoyen(this)">
        <div class="payment-option-icon"><i data-lucide="smartphone" class="icon icon--lg"></i></div>
        <div>
          <div class="payment-option-name">Moov Money</div>
          <div class="payment-option-desc">Paiement via Moov Africa Money</div>
        </div>
      </div>
    </div>

    <div style="padding:16px">
      <div class="form-group">
        <label class="form-label">Numéro Mobile Money</label>
        <div class="input-wrapper">
          <span class="input-icon"><i data-lucide="phone" class="icon icon--sm"></i></span>
          <input class="form-input" type="tel" id="tel-paiement" placeholder="+229 97 00 00 00" autocomplete="tel">
        </div>
        <span class="form-error" id="err-tel-pay"></span>
      </div>
    </div>
  `;
}

window.selectMoyen = function(el) {
  document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
};

// ================================================================
// Écran succès
// ================================================================
function renderSuccess(title, desc, transactionId) {
  return `
    <div class="success-screen">
      <div class="success-icon"><i data-lucide="check-circle" class="icon icon--xl"></i></div>
      <h2 style="font-family:var(--font-display)">${title}</h2>
      <p style="color:var(--ink-mid);text-align:center">${desc}</p>
      ${transactionId ? `<div style="background:var(--sand-dark);padding:10px 16px;border-radius:var(--radius-sm);font-size:0.8125rem;color:var(--ink-mid)">Réf. transaction : ${transactionId}</div>` : ''}
      <button class="btn btn-primary btn-full" onclick="window.location.hash='#home'">Retour à l'accueil</button>
    </div>
  `;
}

function renderError(reason) {
  return `
    <div class="success-screen">
      <div class="success-icon" style="background:var(--red-light)"><i data-lucide="x-circle" class="icon icon--xl"></i></div>
      <h2 style="font-family:var(--font-display)">Paiement échoué</h2>
      <p style="color:var(--ink-mid);text-align:center">${reason || 'Le paiement n\'a pas pu être traité.'}</p>
      <button class="btn btn-primary btn-full" onclick="history.back()">Réessayer</button>
    </div>
  `;
}

// ================================================================
// Init — Caution Escrow
// ================================================================
export async function initPaymentCaution(params = {}) {
  const root = document.getElementById('payment-caution-root');
  if (!root) return;

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  const bailId = params.bail_id;
  const logementId = params.logement_id;
  const montant = parseInt(params.montant) || 0;
  const type = params.type || 'caution';

  // Charger les infos du bail / logement
  let logement = null;
  let bail = null;

  try {
    if (bailId) {
      const { data } = await supabase
        .from('baux')
        .select('*, logements(titre, quartier, ville)')
        .eq('id', bailId)
        .single();
      bail = data;
      logement = bail?.logements;
    } else if (logementId) {
      const { data } = await supabase
        .from('logements')
        .select('id, titre, quartier, ville, loyer_mensuel, caution_mois')
        .eq('id', logementId)
        .single();
      logement = data;
    }
  } catch {}

  const montantFinal = montant || (bail?.caution_montant) || (logement ? logement.loyer_mensuel * (logement.caution_mois || 2) : 0);
  const isBoost = type === 'boost';
  const title = isBoost ? 'Boost de votre annonce' : 'Caution sécurisée (Escrow)';

  root.innerHTML = `
    <div class="payment-header">
      <div style="margin-bottom:8px">${isBoost ? '<i data-lucide="sparkles" class="icon icon--xl"></i>' : '<i data-lucide="lock" class="icon icon--xl"></i>'}</div>
      <div class="payment-amount">${formatFCFA(montantFinal)}</div>
      <div class="payment-desc">${title}</div>
    </div>

    <div class="payment-escrow-info">
      ${isBoost
        ? 'Votre annonce sera mise en avant pendant 7 jours après confirmation du paiement.'
        : `Votre caution de ${formatFCFA(montantFinal)} sera bloquée sur un compte sécurisé et vous sera restituée à la fin du bail si tout s'est bien passé.`
      }
    </div>

    ${logement ? `
    <div style="background:var(--white);margin:0 16px 16px;border-radius:var(--radius);padding:14px;box-shadow:var(--shadow-sm)">
      <div style="font-weight:600;color:var(--ink)">${logement.titre || 'Logement'}</div>
      <div style="font-size:0.875rem;color:var(--ink-mid);margin-top:4px;display:flex;align-items:center;gap:4px"><i data-lucide="map-pin" class="icon icon--sm"></i> ${logement.quartier || ''}, ${logement.ville || ''}</div>
    </div>` : ''}

    ${renderPaymentOptions()}

    <div style="padding:0 16px 32px">
      <button class="btn btn-primary btn-full" id="btn-pay" onclick="doPay()">
        Payer ${formatFCFA(montantFinal)} via MoMo
      </button>
    </div>
  `;
  if (window.renderIcons) window.renderIcons();

  let paiementId = null;

  window.doPay = async () => {
    const tel = document.getElementById('tel-paiement')?.value?.trim();
    if (!tel) {
      const err = document.getElementById('err-tel-pay');
      if (err) { err.textContent = 'Numéro requis'; err.classList.add('show'); }
      return;
    }

    const moyen = document.querySelector('.payment-option.selected')?.dataset.moyen || 'mtn_momo';
    const btn = document.getElementById('btn-pay');
    if (btn) { btn.disabled = true; btn.textContent = 'Ouverture du paiement...'; }

    try {
      const { data: paiement } = await supabase.from('paiements').insert({
        bail_id: bailId || null,
        logement_id: logementId || bail?.logement_id || null,
        payeur_id: user.id,
        beneficiaire_id: bail?.bailleur_id || user.id,
        type: isBoost ? 'boost' : 'caution',
        montant: montantFinal,
        statut: 'en_cours',
        telephone_paiement: tel,
        moyen_paiement: moyen,
      }).select().single();

      paiementId = paiement?.id;

      openKkiapay(
        montantFinal, tel, moyen,
        { paiement_id: paiementId, type: isBoost ? 'boost' : 'caution' },
        async (detail) => {
          await supabase.from('paiements').update({
            statut: 'confirme',
            kkiapay_transaction_id: detail.transactionId,
            webhook_recu_le: new Date().toISOString(),
          }).eq('id', paiementId);

          root.innerHTML = renderSuccess(
            isBoost ? 'Boost activé !' : 'Caution sécurisée !',
            isBoost
              ? 'Votre annonce est maintenant mise en avant pendant 7 jours.'
              : `${formatFCFA(montantFinal)} bloqués sur compte escrow. Vous récupérez votre caution à la fin du bail.`,
            detail.transactionId
          );
          if (window.renderIcons) window.renderIcons();
        },
        async (reason) => {
          if (paiementId) await supabase.from('paiements').update({ statut: 'echec' }).eq('id', paiementId);
          root.innerHTML = renderError(reason);
          if (window.renderIcons) window.renderIcons();
        }
      );
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = `Payer ${formatFCFA(montantFinal)} via MoMo`; }
    }
  };
}

// ================================================================
// Init — Loyer mensuel
// ================================================================
export async function initPaymentLoyer(params = {}) {
  const root = document.getElementById('payment-loyer-root');
  if (!root) return;

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  // Support token signé (lien depuis chat)
  let bailId = params.bail_id;
  let mois = params.mois;
  let montant = parseInt(params.montant) || 0;

  if (params.token) {
    try {
      const decoded = JSON.parse(atob(params.token));
      if (decoded.exp < Date.now()) {
        root.innerHTML = renderError('Ce lien de paiement a expiré.');
        if (window.renderIcons) window.renderIcons();
        return;
      }
      bailId = decoded.bail_id;
      mois = decoded.mois;
      montant = decoded.montant;
    } catch {
      root.innerHTML = renderError('Lien de paiement invalide.');
      if (window.renderIcons) window.renderIcons();
      return;
    }
  }

  // Charger bail
  let bail = null;
  let historique = [];
  try {
    const [{ data: bailData }, { data: hist }] = await Promise.all([
      supabase.from('baux').select('*, logements(titre, quartier), locataire:profiles!locataire_id(nom, prenom)').eq('id', bailId).single(),
      supabase.from('paiements').select('mois_concerne, statut').eq('bail_id', bailId).eq('type', 'loyer_mensuel').order('created_at', { ascending: false }).limit(6),
    ]);
    bail = bailData;
    historique = hist || [];
  } catch {}

  const montantFinal = montant || bail?.loyer_mensuel || 0;
  const moisLabel2 = moisLabel(mois) || mois || 'Mois en cours';

  const statusClass = { confirme: 'paye', en_cours: 'en-cours', echec: 'retard', en_attente: 'futur' };

  root.innerHTML = `
    <div class="payment-header">
      <div style="margin-bottom:8px"><i data-lucide="home" class="icon icon--xl"></i></div>
      <div class="payment-amount">${formatFCFA(montantFinal)}</div>
      <div class="payment-desc">Loyer ${moisLabel2}</div>
    </div>

    ${bail ? `
    <div style="background:var(--white);margin:16px;border-radius:var(--radius);padding:14px;box-shadow:var(--shadow-sm)">
      <div style="font-weight:600;color:var(--ink)">${bail.logements?.titre || 'Logement'}</div>
      <div style="font-size:0.875rem;color:var(--ink-mid);margin-top:2px;display:flex;align-items:center;gap:4px"><i data-lucide="map-pin" class="icon icon--sm"></i> ${bail.logements?.quartier || ''}</div>
      <div style="font-size:0.875rem;color:var(--ink-mid);margin-top:2px">Locataire : ${bail.locataire?.prenom || ''} ${bail.locataire?.nom || ''}</div>
    </div>` : ''}

    ${renderPaymentOptions()}

    <div style="padding:0 16px 16px">
      <button class="btn btn-primary btn-full" id="btn-pay-loyer" onclick="doPayLoyer()">
        Payer ${formatFCFA(montantFinal)}
      </button>
    </div>

    ${historique.length ? `
    <div style="padding:0 16px 32px">
      <div style="font-weight:500;margin-bottom:10px;font-size:0.875rem;color:var(--ink-mid)">Historique récent</div>
      <div class="mois-grid">
        ${historique.map(h => `<div class="mois-pill ${statusClass[h.statut] || 'futur'}">${h.mois_concerne?.slice(5) || '—'}</div>`).join('')}
      </div>
    </div>` : ''}
  `;
  if (window.renderIcons) window.renderIcons();

  let paiementId = null;

  window.doPayLoyer = async () => {
    const tel = document.getElementById('tel-paiement')?.value?.trim();
    if (!tel) {
      const err = document.getElementById('err-tel-pay');
      if (err) { err.textContent = 'Numéro requis'; err.classList.add('show'); }
      return;
    }
    const moyen = document.querySelector('.payment-option.selected')?.dataset.moyen || 'mtn_momo';
    const btn = document.getElementById('btn-pay-loyer');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      const { data: paiement } = await supabase.from('paiements').insert({
        bail_id: bailId,
        logement_id: bail?.logement_id || null,
        payeur_id: user.id,
        beneficiaire_id: bail?.bailleur_id || user.id,
        type: 'loyer_mensuel',
        montant: montantFinal,
        mois_concerne: mois || null,
        statut: 'en_cours',
        telephone_paiement: tel,
        moyen_paiement: moyen,
      }).select().single();
      paiementId = paiement?.id;

      openKkiapay(
        montantFinal, tel, moyen,
        { paiement_id: paiementId, type: 'loyer_mensuel', mois },
        async (detail) => {
          await supabase.from('paiements').update({
            statut: 'confirme',
            kkiapay_transaction_id: detail.transactionId,
            webhook_recu_le: new Date().toISOString(),
          }).eq('id', paiementId);
          root.innerHTML = renderSuccess(
            'Paiement confirmé !',
            `Votre loyer de ${formatFCFA(montantFinal)} pour ${moisLabel2} a été reçu.`,
            detail.transactionId
          );
          if (window.renderIcons) window.renderIcons();
        },
        async (reason) => {
          if (paiementId) await supabase.from('paiements').update({ statut: 'echec' }).eq('id', paiementId);
          root.innerHTML = renderError(reason);
          if (window.renderIcons) window.renderIcons();
        }
      );
    } catch (err) {
      showToast(err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = `Payer ${formatFCFA(montantFinal)}`; }
    }
  };
}

// ================================================================
// Générer lien paiement loyer (depuis loyers.js / chat)
// ================================================================
export function genererLienPaiement(bailId, mois, montant) {
  const token = btoa(JSON.stringify({
    bail_id: bailId,
    mois,
    montant,
    exp: Date.now() + 86400000,
  }));
  return `${window.location.origin}/#payment-loyer?token=${token}`;
}
