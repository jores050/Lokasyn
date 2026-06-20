// ================================================================
// LocaSyn — admin.js
// Backoffice administration
// ================================================================

import supabase from '../supabase.js';
import { formatFCFA, formatDateShort, initiales, showToast } from '../utils.js';
import { getCurrentUser } from '../auth.js';

export async function init() {
  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') { window.location.hash = '#home'; return; }

  window.__adminLoadTab = loadTab;
  loadTab('moderation');
}

async function loadTab(tab) {
  const content = document.getElementById('admin-content');
  if (!content) return;
  content.innerHTML = '<div style="display:flex;justify-content:center;padding:40px"><div class="spinner spinner-lg"></div></div>';

  try {
    switch (tab) {
      case 'moderation': await loadModeration(content); break;
      case 'utilisateurs': await loadUtilisateurs(content); break;
      case 'paiements': await loadPaiements(content); break;
      case 'signalements': await loadSignalements(content); break;
      case 'retraits': await loadRetraits(content); break;
      case 'contestations': await loadContestations(content); break;
      case 'stats': await loadStats(content); break;
      default: content.innerHTML = '<p style="padding:16px">Tab inconnu</p>';
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div><h3>Erreur</h3><p>${err.message}</p></div>`;
    if (window.renderIcons) window.renderIcons();
  }
}

// ================================================================
// Modération
// ================================================================
async function loadModeration(root) {
  const { data, error } = await supabase
    .from('logements')
    .select('*, profiles!bailleur_id(nom, prenom, telephone)')
    .eq('statut', 'en_moderation')
    .order('created_at', { ascending: true });

  if (error) throw error;

  if (!data?.length) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="check-circle" class="icon"></i></div><h3>File vide</h3><p>Aucune annonce en attente de modération.</p></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  root.innerHTML = `<div class="admin-tab-content">
    <p style="font-size:0.875rem;color:var(--ink-mid);margin-bottom:16px">${data.length} annonce(s) à modérer</p>
    ${data.map(l => `
      <div class="moderation-item">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:48px;height:48px;border-radius:var(--radius-sm);overflow:hidden;background:var(--sand-dark);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.5rem">
            ${l.photos?.[0] ? `<img src="${l.photos[0]}" style="width:100%;height:100%;object-fit:cover">` : '<i data-lucide="home" class="icon icon--lg"></i>'}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;color:var(--ink)">${l.titre}</div>
            <div style="font-size:0.8125rem;color:var(--ink-light)">${l.quartier}, ${l.ville} · ${formatFCFA(l.loyer_mensuel)}/mois</div>
            <div style="font-size:0.75rem;color:var(--ink-light)">Bailleur : ${l.profiles?.prenom} ${l.profiles?.nom} · ${l.profiles?.telephone || 'N/A'}</div>
          </div>
        </div>
        ${l.description ? `<p style="font-size:0.8125rem;color:var(--ink-mid);margin-bottom:8px">${l.description.slice(0, 150)}...</p>` : ''}
        <div class="moderation-actions">
          <button class="btn btn-primary btn-sm" onclick="approuver('${l.id}')"><i data-lucide="check" class="icon icon--sm"></i> Approuver</button>
          <button class="btn btn-danger btn-sm" onclick="rejeter('${l.id}')"><i data-lucide="x" class="icon icon--sm"></i> Rejeter</button>
          <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#listing-detail?id=${l.id}'">Voir</button>
        </div>
      </div>
    `).join('')}
  </div>`;
  if (window.renderIcons) window.renderIcons();

  window.approuver = async (id) => {
    await supabase.from('logements').update({ statut: 'libre', verifie: true, verifie_le: new Date().toISOString() }).eq('id', id);
    showToast('Annonce approuvée ✓', 'success');
    loadTab('moderation');
  };

  window.rejeter = async (id) => {
    const motif = prompt('Motif du rejet (sera communiqué au bailleur) :');
    if (!motif) return;
    await supabase.from('logements').update({ statut: 'archive' }).eq('id', id);
    showToast('Annonce rejetée', 'info');
    loadTab('moderation');
  };
}

// ================================================================
// Utilisateurs
// ================================================================
async function loadUtilisateurs(root) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  const roleColors = { admin: 'badge-red', bailleur: 'badge-amber', agence: 'badge-amber', locataire: 'badge-ink' };

  root.innerHTML = `<div class="admin-tab-content">
    <p style="font-size:0.875rem;color:var(--ink-mid);margin-bottom:16px">${data?.length || 0} utilisateurs (50 derniers)</p>
    ${(data || []).map(u => `
      <div class="list-item">
        <div class="avatar avatar-sm" style="background:var(--green)">${initiales(u.nom, u.prenom)}</div>
        <div class="list-item-content">
          <div class="list-item-title">${u.prenom} ${u.nom}</div>
          <div class="list-item-subtitle">${u.telephone || u.ville || '—'} · Inscrit ${formatDateShort(u.created_at)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="badge ${roleColors[u.role] || 'badge-ink'}">${u.role}</span>
          ${u.kyc_verifie ? '<span class="badge badge-green" style="font-size:0.625rem">KYC ✓</span>' : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
}

// ================================================================
// Paiements
// ================================================================
async function loadPaiements(root) {
  const { data, error } = await supabase
    .from('paiements')
    .select('*, payeur:profiles!payeur_id(nom, prenom), logements(titre)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  const statutColors = {
    confirme: 'badge-green', en_cours: 'badge-amber',
    echec: 'badge-red', en_attente: 'badge-ink', rembourse: 'badge-ink'
  };

  root.innerHTML = `<div class="admin-tab-content">
    <p style="font-size:0.875rem;color:var(--ink-mid);margin-bottom:16px">${data?.length || 0} paiements (50 derniers)</p>
    ${(data || []).map(p => `<div class="list-item">
        <div><i data-lucide="${p.type === 'caution' ? 'lock' : p.type === 'loyer_mensuel' ? 'wallet' : 'zap'}" class="icon icon--lg"></i></div>
        <div class="list-item-content">
          <div class="list-item-title">${formatFCFA(p.montant)} · ${p.type.replace('_', ' ')}</div>
          <div class="list-item-subtitle">${p.payeur?.prenom} ${p.payeur?.nom} · ${p.logements?.titre || '—'} · ${formatDateShort(p.created_at)}</div>
          ${p.kkiapay_transaction_id ? `<div style="font-size:0.75rem;color:var(--ink-light)">Réf: ${p.kkiapay_transaction_id}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
          <span class="badge ${statutColors[p.statut] || 'badge-ink'}">${p.statut}</span>
          ${p.statut === 'confirme' && p.type === 'caution' && !p.escrow_libere
            ? `<button class="btn btn-secondary btn-sm" onclick="libererEscrow('${p.id}')">Libérer</button>`
            : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
  if (window.renderIcons) window.renderIcons();

  window.libererEscrow = async (id) => {
    if (!confirm('Libérer la caution vers le bailleur ?')) return;
    await supabase.from('paiements').update({ escrow_libere: true, escrow_libere_le: new Date().toISOString() }).eq('id', id);
    showToast('Caution libérée', 'success');
    loadTab('paiements');
  };
}

// ================================================================
// Signalements
// ================================================================
async function loadSignalements(root) {
  const { data, error } = await supabase
    .from('signalements')
    .select('*, signaleur:profiles!signaleur_id(nom, prenom), logements(titre)')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true });

  if (error) throw error;

  if (!data?.length) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="check-circle" class="icon"></i></div><h3>Aucun signalement</h3><p>Tous les signalements ont été traités.</p></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  root.innerHTML = `<div class="admin-tab-content">
    ${data.map(s => `
      <div class="moderation-item">
        <div style="font-weight:600;color:var(--red);display:flex;align-items:center;gap:6px"><i data-lucide="flag" class="icon icon--sm"></i> ${s.motif}</div>
        <div style="font-size:0.875rem;color:var(--ink-mid);margin-top:4px">${s.description || '—'}</div>
        <div style="font-size:0.8125rem;color:var(--ink-light);margin-top:4px">
          Par ${s.signaleur?.prenom} ${s.signaleur?.nom}
          ${s.logements ? ` · Logement : ${s.logements.titre}` : ''}
          · ${formatDateShort(s.created_at)}
        </div>
        <div class="moderation-actions">
          <button class="btn btn-primary btn-sm" onclick="traiterSignalement('${s.id}','traite')"><i data-lucide="check" class="icon icon--sm"></i> Traité</button>
          <button class="btn btn-secondary btn-sm" onclick="traiterSignalement('${s.id}','rejete')">Rejeter</button>
        </div>
      </div>
    `).join('')}
  </div>`;
  if (window.renderIcons) window.renderIcons();

  window.traiterSignalement = async (id, statut) => {
    await supabase.from('signalements').update({ statut }).eq('id', id);
    showToast(`Signalement marqué : ${statut}`, 'success');
    loadTab('signalements');
  };
}

// ================================================================
// Retraits en attente
// ================================================================
async function loadRetraits(root) {
  const { data, error } = await supabase
    .from('retraits')
    .select('*, profiles!utilisateur_id(nom, prenom, telephone)')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true });

  if (error) throw error;

  if (!data?.length) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="check-circle" class="icon"></i></div><h3>Aucun retrait en attente</h3><p>Toutes les demandes ont été traitées.</p></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  const moyenLabel = { mtn_momo: 'MTN MoMo', moov_money: 'Moov Money' };

  root.innerHTML = `<div class="admin-tab-content">
    <p style="font-size:0.875rem;color:var(--ink-mid);margin-bottom:16px">${data.length} demande(s) en attente</p>
    ${data.map(r => `
      <div class="moderation-item">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="flex:1">
            <div style="font-weight:600;color:var(--ink);font-size:1rem">${formatFCFA(r.montant)}</div>
            <div style="font-size:0.8125rem;color:var(--ink-light)">${moyenLabel[r.moyen_paiement] || r.moyen_paiement} · ${r.telephone_reception}</div>
            <div style="font-size:0.8125rem;color:var(--ink-light)">
              Bailleur : ${r.profiles?.prenom || ''} ${r.profiles?.nom || ''} · ${r.profiles?.telephone || '—'}
            </div>
            <div style="font-size:0.75rem;color:var(--ink-light);margin-top:2px">Demandé le ${formatDateShort(r.created_at)}</div>
          </div>
        </div>
        <div class="moderation-actions">
          <button class="btn btn-primary btn-sm" onclick="marquerRetraitEffectue('${r.id}','${r.utilisateur_id}',${r.montant})">
            <i data-lucide="check" class="icon icon--sm"></i> Marquer effectué
          </button>
          <button class="btn btn-danger btn-sm" onclick="rejeterRetrait('${r.id}')">
            <i data-lucide="x" class="icon icon--sm"></i> Rejeter
          </button>
        </div>
      </div>
    `).join('')}
  </div>`;
  if (window.renderIcons) window.renderIcons();

  window.marquerRetraitEffectue = async (retraitId, utilisateurId, montant) => {
    if (!confirm(`Confirmer le virement de ${formatFCFA(montant)} ? Cette action est irréversible.`)) return;
    const admin = await import('../auth.js').then(m => m.getCurrentUser());

    const { error: retraitErr } = await supabase.from('retraits').update({
      statut: 'effectue',
      traite_par_admin_id: admin?.id,
      traite_le: new Date().toISOString(),
    }).eq('id', retraitId);

    if (retraitErr) { showToast('Erreur mise à jour retrait', 'error'); return; }

    // Débiter le solde du bailleur
    const { data: solde } = await supabase.from('soldes').select('*').eq('utilisateur_id', utilisateurId).maybeSingle();
    if (solde) {
      await supabase.from('soldes').update({
        montant_disponible: Math.max(0, solde.montant_disponible - montant),
        montant_total_retire: (solde.montant_total_retire || 0) + montant,
        updated_at: new Date().toISOString(),
      }).eq('utilisateur_id', utilisateurId);
    }

    // Tracer le mouvement
    await supabase.from('mouvements_solde').insert({
      utilisateur_id: utilisateurId,
      type: 'retrait',
      montant: -montant,
      retrait_id: retraitId,
      description: 'Retrait effectué par admin',
    }).then(null, e => console.warn('[ADMIN] Mouvement retrait non tracé:', e));

    showToast('Retrait marqué comme effectué ✓', 'success');
    loadTab('retraits');
  };

  window.rejeterRetrait = async (retraitId) => {
    const note = prompt('Motif du rejet (communiqué au bailleur) :');
    if (note === null) return;
    await supabase.from('retraits').update({ statut: 'rejete', note_admin: note }).eq('id', retraitId);
    showToast('Retrait rejeté', 'info');
    loadTab('retraits');
  };
}

// ================================================================
// Contestations de visites
// ================================================================
async function loadContestations(root) {
  const { data, error } = await supabase
    .from('rendez_vous')
    .select(`
      id, date_visite, heure_visite, contestation_motif, statut,
      logements(titre, ref_interne),
      paiements(id, montant, statut),
      demandeur:profiles!demandeur_id(nom, prenom),
      bailleur:profiles!bailleur_id(nom, prenom)
    `)
    .not('contestation_motif', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  if (!data?.length) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="shield-check" class="icon"></i></div><h3>Aucune contestation</h3><p>Tout va bien.</p></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  root.innerHTML = `<div class="admin-tab-content">
    <p style="font-size:0.875rem;color:var(--ink-mid);margin-bottom:16px">${data.length} contestation(s)</p>
    ${data.map(r => {
      const paiement = r.paiements;
      const estEnContestation = paiement?.statut === 'en_contestation';
      return `
        <div class="moderation-item" style="${estEnContestation ? 'border-left:3px solid var(--amber,#f59e0b)' : 'opacity:0.6'}">
          <div style="margin-bottom:8px">
            <div style="font-weight:600;color:var(--ink)">${r.logements?.titre || 'Logement'} · ${r.logements?.ref_interne || ''}</div>
            <div style="font-size:0.8125rem;color:var(--ink-light)">
              Visite du ${formatDateShort(r.date_visite)} à ${r.heure_visite || '—'}
            </div>
            <div style="font-size:0.8125rem;color:var(--ink-light)">
              Locataire : ${r.demandeur?.prenom || ''} ${r.demandeur?.nom || ''} &nbsp;|&nbsp;
              Bailleur : ${r.bailleur?.prenom || ''} ${r.bailleur?.nom || ''}
            </div>
            ${paiement ? `<div style="font-size:0.8125rem;color:var(--ink-light)">Montant : ${formatFCFA(paiement.montant)} · Statut paiement : ${paiement.statut}</div>` : ''}
            <div style="margin-top:8px;padding:8px;background:var(--sand,#fef3c7);border-radius:var(--radius-sm);font-size:0.8125rem;color:var(--ink)">
              <strong>Motif bailleur :</strong> ${r.contestation_motif}
            </div>
          </div>
          ${estEnContestation && paiement ? `
            <div class="moderation-actions">
              <button class="btn btn-primary btn-sm" onclick="libererPaiementContestation('${r.id}','${paiement.id}',${paiement.montant})">
                <i data-lucide="check" class="icon icon--sm"></i> Libérer au bailleur (90%)
              </button>
              <button class="btn btn-danger btn-sm" onclick="rembourserLocataire('${r.id}','${paiement.id}')">
                <i data-lucide="rotate-ccw" class="icon icon--sm"></i> Rembourser locataire
              </button>
            </div>` : `<div style="font-size:0.75rem;color:var(--ink-light)">Déjà traité · statut RDV : ${r.statut}</div>`}
        </div>
      `;
    }).join('')}
  </div>`;
  if (window.renderIcons) window.renderIcons();

  window.libererPaiementContestation = async (rdvId, paiementId, montant) => {
    if (!confirm(`Libérer ${formatFCFA(Math.round(montant * 0.9))} au bailleur ? Cette action est irréversible.`)) return;
    const montantBailleur = Math.round(montant * 0.9);

    const { data: rdv } = await supabase.from('rendez_vous').select('bailleur_id').eq('id', rdvId).single();

    await supabase.from('paiements').update({
      statut: 'confirme',
      escrow_libere: true,
      escrow_libere_le: new Date().toISOString(),
      montant_bailleur: montantBailleur,
      montant_commission_plateforme: Math.round(montant * 0.1),
    }).eq('id', paiementId);

    await supabase.from('rendez_vous').update({ statut: 'effectue' }).eq('id', rdvId);

    const { data: solde } = await supabase.from('soldes').select('*').eq('utilisateur_id', rdv.bailleur_id).maybeSingle();
    if (solde) {
      await supabase.from('soldes').update({
        montant_disponible: solde.montant_disponible + montantBailleur,
        montant_total_recu: solde.montant_total_recu + montantBailleur,
        updated_at: new Date().toISOString(),
      }).eq('utilisateur_id', rdv.bailleur_id);
    } else {
      await supabase.from('soldes').insert({ utilisateur_id: rdv.bailleur_id, montant_disponible: montantBailleur, montant_total_recu: montantBailleur });
    }

    await supabase.from('mouvements_solde').insert({
      utilisateur_id: rdv.bailleur_id,
      type: 'credit_visite',
      montant: montantBailleur,
      paiement_id: paiementId,
      description: 'Contestation tranchée par admin — visite validée',
    }).then(null, e => console.warn('[ADMIN] Mouvement non tracé:', e));

    showToast(`${formatFCFA(montantBailleur)} crédités au bailleur ✓`, 'success');
    loadTab('contestations');
  };

  window.rembourserLocataire = async (rdvId, paiementId) => {
    if (!confirm('Rembourser le locataire ? Ceci marque le paiement comme remboursé et le RDV comme refusé.')) return;

    await supabase.from('paiements').update({ statut: 'rembourse', escrow_libere: true }).eq('id', paiementId);
    await supabase.from('rendez_vous').update({ statut: 'refuse' }).eq('id', rdvId);

    showToast('Remboursement enregistré — à déclencher manuellement via votre opérateur', 'info');
    loadTab('contestations');
  };
}

// ================================================================
// Stats globales
// ================================================================
async function loadStats(root) {
  const [
    { count: nUsers },
    { count: nLogements },
    { count: nConvs },
    { count: nPaiments },
    { data: revenu },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('logements').select('id', { count: 'exact', head: true }),
    supabase.from('conversations').select('id', { count: 'exact', head: true }),
    supabase.from('paiements').select('id', { count: 'exact', head: true }).eq('statut', 'confirme'),
    supabase.from('paiements').select('montant').eq('statut', 'confirme'),
  ]);

  const totalRevenu = (revenu || []).reduce((s, p) => s + (p.montant || 0), 0);

  root.innerHTML = `<div class="admin-tab-content">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
      ${[
        { label: 'Utilisateurs', value: nUsers || 0, icon: 'user' },
        { label: 'Logements', value: nLogements || 0, icon: 'home' },
        { label: 'Conversations', value: nConvs || 0, icon: 'message-circle' },
        { label: 'Paiements confirmés', value: nPaiments || 0, icon: 'check-circle' },
      ].map(s => `
        <div style="background:var(--white);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow-sm);text-align:center">
          <div><i data-lucide="${s.icon}" class="icon icon--lg"></i></div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--ink);margin-top:4px">${s.value}</div>
          <div style="font-size:0.75rem;color:var(--ink-light);margin-top:2px">${s.label}</div>
        </div>
      `).join('')}
    </div>
    <div style="background:var(--green);border-radius:var(--radius);padding:20px;text-align:center">
      <div style="font-size:0.875rem;color:rgba(255,255,255,0.8)">Volume total transactions</div>
      <div style="font-family:var(--font-display);font-size:2rem;color:var(--white);margin-top:4px">${formatFCFA(totalRevenu)}</div>
    </div>
  </div>`;
  if (window.renderIcons) window.renderIcons();
}
