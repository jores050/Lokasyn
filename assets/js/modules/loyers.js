// ================================================================
// LocaSyn — loyers.js
// Suivi des loyers bailleur
// ================================================================

import supabase from '../supabase.js';
import { formatFCFA, initiales, avatarColor, formatDateShort, moisLabel, moisActuel, showToast } from '../utils.js';
import { getCurrentUser } from '../auth.js';
import { genererLienPaiement } from './payment.js';
import { sendMessage } from './messaging.js';

const MOIS_NOMS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function getMoisPillStatus(moisStr, paiements) {
  const p = paiements.find(p => p.mois_concerne === moisStr);
  if (!p) {
    const now = new Date();
    const [y, m] = moisStr.split('-').map(Number);
    const moisDate = new Date(y, m - 1, 1);
    return moisDate > now ? 'futur' : 'retard';
  }
  if (p.statut === 'confirme') return 'paye';
  if (p.statut === 'en_cours') return 'en-cours';
  if (p.statut === 'echec') return 'retard';
  return 'futur';
}

function getMoisDepuisBail(dateDebut) {
  const start = new Date(dateDebut);
  const now = new Date();
  const mois = [];
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= now && mois.length < 12) {
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    mois.push(key);
    current.setMonth(current.getMonth() + 1);
  }
  return mois;
}

export async function init() {
  const root = document.getElementById('loyers-root');
  if (!root) return;

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  try {
    // Charger tous les baux actifs avec locataires et logements
    const { data: baux, error } = await supabase
      .from('baux')
      .select(`
        id, loyer_mensuel, caution_montant, date_debut, date_fin, statut, logement_id,
        logements(id, titre, quartier, ref_interne),
        locataire:profiles!locataire_id(id, nom, prenom, telephone, photo_url)
      `)
      .eq('bailleur_id', user.id)
      .eq('statut', 'actif')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!baux?.length) {
      root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="wallet" class="icon"></i></div><h3>Aucun bail actif</h3><p>Vos baux actifs et le suivi des loyers apparaîtront ici.</p></div>`;
      if (window.renderIcons) window.renderIcons();
      return;
    }

    // Charger tous les paiements pour ces baux
    const bailIds = baux.map(b => b.id);
    const { data: allPaiements } = await supabase
      .from('paiements')
      .select('bail_id, mois_concerne, statut, montant, created_at')
      .in('bail_id', bailIds)
      .eq('type', 'loyer_mensuel')
      .order('created_at', { ascending: false });

    const paiementsParBail = {};
    (allPaiements || []).forEach(p => {
      if (!paiementsParBail[p.bail_id]) paiementsParBail[p.bail_id] = [];
      paiementsParBail[p.bail_id].push(p);
    });

    // Calculer métriques globales
    const currentMois = moisActuel();
    let totalRecu = 0, enAttente = 0, enRetard = 0;
    baux.forEach(bail => {
      const pList = paiementsParBail[bail.id] || [];
      const currentPay = pList.find(p => p.mois_concerne === currentMois);
      if (currentPay?.statut === 'confirme') totalRecu += bail.loyer_mensuel;
      else if (currentPay?.statut === 'en_cours') enAttente += bail.loyer_mensuel;
      else enRetard += bail.loyer_mensuel;
    });

    root.innerHTML = `
      <div class="loyers-metrics">
        <div class="loyer-metric">
          <div class="loyer-metric-value" style="color:var(--green);font-size:1rem">${formatFCFA(totalRecu).replace(' FCFA','')}</div>
          <div class="loyer-metric-label">Reçu ce mois</div>
        </div>
        <div class="loyer-metric">
          <div class="loyer-metric-value" style="color:var(--amber);font-size:1rem">${formatFCFA(enAttente).replace(' FCFA','')}</div>
          <div class="loyer-metric-label">En attente</div>
        </div>
        <div class="loyer-metric">
          <div class="loyer-metric-value" style="color:var(--red);font-size:1rem">${formatFCFA(enRetard).replace(' FCFA','')}</div>
          <div class="loyer-metric-label">En retard</div>
        </div>
      </div>

      ${baux.map(bail => {
        const pList = paiementsParBail[bail.id] || [];
        const moisList = getMoisDepuisBail(bail.date_debut);
        const loc = bail.locataire;
        const color = avatarColor(`${loc?.prenom}${loc?.nom}`);
        const inis = initiales(loc?.nom, loc?.prenom);

        return `
          <div class="bail-card">
            <div class="bail-card-header">
              <div>
                <div class="bail-card-title">${bail.logements?.titre || 'Logement'}</div>
                <div class="bail-card-ref">${bail.logements?.ref_interne || ''} · ${bail.logements?.quartier || ''}</div>
              </div>
              <div style="font-weight:700;color:var(--green)">${formatFCFA(bail.loyer_mensuel)}/mois</div>
            </div>

            <div class="bail-card-locataire">
              <div class="avatar avatar-sm" style="background:${color}">
                ${loc?.photo_url ? `<img src="${loc.photo_url}">` : inis}
              </div>
              <div style="flex:1">
                <div style="font-weight:500;font-size:0.9375rem">${loc?.prenom || ''} ${loc?.nom || ''}</div>
                <div style="font-size:0.8125rem;color:var(--ink-light)">Depuis ${formatDateShort(bail.date_debut)}</div>
              </div>
            </div>

            <div class="bail-card-mois">
              <div style="font-size:0.8125rem;font-weight:500;color:var(--ink-mid);margin-bottom:8px">Paiements</div>
              <div class="mois-grid">
                ${moisList.map(mois => {
                  const status = getMoisPillStatus(mois, pList);
                  const label = MOIS_NOMS[parseInt(mois.split('-')[1]) - 1];
                  return `<div class="mois-pill ${status}" title="${moisLabel(mois)}">${label}</div>`;
                }).join('')}
              </div>
            </div>

            <div class="bail-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="relanceLoyer('${bail.id}','${loc?.telephone || ''}','${currentMois}',${bail.loyer_mensuel})">
                <i data-lucide="smartphone" class="icon icon--sm"></i> Relance
              </button>
              <button class="btn btn-primary btn-sm" onclick="envoyerLienLoyer('${bail.id}','${currentMois}',${bail.loyer_mensuel})">
                <i data-lucide="wallet" class="icon icon--sm"></i> Envoyer lien MoMo
              </button>
            </div>
          </div>
        `;
      }).join('')}

      <div style="height:32px"></div>
    `;
    if (window.renderIcons) window.renderIcons();

    // Handlers
    window.relanceLoyer = async (bailId, telephone, mois, montant) => {
      if (!telephone) { showToast('Numéro de téléphone non renseigné', 'warning'); return; }
      try {
        const lien = genererLienPaiement(bailId, mois, montant);
        await supabase.functions.invoke('whatsapp-notify', {
          body: {
            telephone,
            type: 'relance_loyer',
            data: { mois: moisLabel(mois), montant: formatFCFA(montant), lien },
          },
        });
        showToast('Relance WhatsApp envoyée !', 'success');
      } catch {
        showToast('Erreur envoi WhatsApp', 'error');
      }
    };

    window.envoyerLienLoyer = async (bailId, mois, montant) => {
      try {
        // Chercher la conversation liée
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .limit(1)
          .single();

        if (!conv) { showToast('Aucune conversation avec ce locataire', 'warning'); return; }

        await sendMessage(conv.id, null, 'lien_paiement', {
          bail_id: bailId,
          mois,
          montant,
          message: `Loyer ${moisLabel(mois)} — ${formatFCFA(montant)}`,
        });
        showToast('Lien de paiement envoyé en messagerie ✓', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    // Export PDF (basique — liste text)
    document.getElementById('btn-export')?.addEventListener('click', () => {
      showToast('Export PDF — bientôt disponible', 'info');
    });

  } catch (err) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div><h3>Erreur</h3><p>${err.message}</p></div>`;
    if (window.renderIcons) window.renderIcons();
  }
}
