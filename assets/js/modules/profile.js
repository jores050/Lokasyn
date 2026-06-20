// ================================================================
// LocaSyn — profile.js
// Dashboard bailleur / locataire, mes-annonces, contrats, boost
// ================================================================

import supabase from '../supabase.js';
import { formatFCFA, initiales, avatarColor, renderStars, formatDate, formatDateShort, LOGEMENT_LABEL, showToast, moisLabel } from '../utils.js';
import { getCurrentUser, signOut } from '../auth.js';
import { genererLienPaiement } from './payment.js';

// ================================================================
// Init — Profil principal
// ================================================================
export async function init() {
  const root = document.getElementById('profile-root');
  if (!root) return;

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  let { data: profile, error: profileErr } = await supabase
    .from('profiles').select('*').eq('id', user.id).maybeSingle();

  if (profileErr) {
    console.error('[PROFILE] Erreur chargement profil:', profileErr);
  }

  // Profil absent en base (inscription incomplète) — créer un profil minimal
  if (!profile) {
    console.warn('[PROFILE] Profil introuvable pour', user.id, '— création du profil manquant');
    const role = sessionStorage.getItem('locasyn_role') || 'locataire';
    const meta = user.user_metadata || {};
    const { data: created } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        role,
        nom: meta.nom || meta.full_name?.split(' ').slice(-1)[0] || '',
        prenom: meta.prenom || meta.full_name?.split(' ')[0] || '',
        telephone: meta.telephone || '',
      })
      .select('*')
      .single();
    profile = created;
  }

  if (!profile) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div><h3>Erreur de chargement</h3><p>Impossible de charger votre profil. Réessayez.</p><button class="btn btn-primary" onclick="window.location.reload()">Réessayer</button></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  const isBailleur = profile.role === 'bailleur' || profile.role === 'agence';
  const color = avatarColor(`${profile.prenom}${profile.nom}`);
  const inis = initiales(profile.nom, profile.prenom);

  // Charger stats
  let stats = { logements: 0, loues: 0, bail: null };
  if (isBailleur) {
    const [{ count: nLog }, { count: nLoues }] = await Promise.all([
      supabase.from('logements').select('id', { count: 'exact', head: true }).eq('bailleur_id', user.id).neq('statut', 'archive'),
      supabase.from('logements').select('id', { count: 'exact', head: true }).eq('bailleur_id', user.id).eq('statut', 'loue'),
    ]);
    stats.logements = nLog || 0;
    stats.loues = nLoues || 0;
  } else {
    const { data: bail } = await supabase
      .from('baux')
      .select('*, logements(titre, quartier)')
      .eq('locataire_id', user.id)
      .eq('statut', 'actif')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    stats.bail = bail;
  }

  root.innerHTML = `
    <div class="profile-header">
      <div class="avatar avatar-lg" style="background:${color};margin:0 auto">
        ${profile.photo_url ? `<img src="${profile.photo_url}" alt="${profile.prenom}">` : inis}
      </div>
      <div class="profile-header-name">${profile.prenom} ${profile.nom}</div>
      <div class="profile-header-role" style="display:flex;align-items:center;gap:6px;justify-content:center">${
        { locataire: '<i data-lucide="home" class="icon icon--sm"></i> Locataire', bailleur: '<i data-lucide="key" class="icon icon--sm"></i> Bailleur', agence: '<i data-lucide="building" class="icon icon--sm"></i> Agence', admin: '<i data-lucide="settings" class="icon icon--sm"></i> Admin' }[profile.role] || profile.role
      } · ${profile.ville || 'Bénin'}</div>
      ${profile.kyc_verifie ? '<div style="margin-top:6px"><span class="badge badge-white"><i data-lucide="badge-check" class="icon icon--sm"></i> Identité vérifiée</span></div>' : ''}
    </div>

    <div class="profile-stats">
      ${isBailleur ? `
        <div class="profile-stat">
          <div class="profile-stat-value">${stats.logements}</div>
          <div class="profile-stat-label">Logements</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">${stats.loues}</div>
          <div class="profile-stat-label">Loués</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value" style="display:flex;align-items:center;gap:4px;justify-content:center">${profile.note_moyenne ? `${profile.note_moyenne.toFixed(1)} <i data-lucide="star" class="icon icon--sm" style="fill:var(--color-gold);color:var(--color-gold)"></i>` : '—'}</div>
          <div class="profile-stat-label">Note</div>
        </div>
      ` : `
        <div class="profile-stat">
          <div class="profile-stat-value">${stats.bail ? '<i data-lucide="check-circle" class="icon" style="color:var(--green)"></i>' : '—'}</div>
          <div class="profile-stat-label">Bail actif</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">${stats.bail ? formatFCFA(stats.bail.loyer_mensuel).replace(' FCFA', '') : '—'}</div>
          <div class="profile-stat-label">Loyer/mois</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-value">${stats.bail ? formatDateShort(stats.bail.date_debut) : '—'}</div>
          <div class="profile-stat-label">Depuis</div>
        </div>
      `}
    </div>

    <div style="height:16px"></div>

    ${isBailleur ? `
    <div class="profile-menu">
      <a class="profile-menu-item" href="#loyers">
        <span class="profile-menu-icon"><i data-lucide="wallet" class="icon"></i></span>
        <span class="profile-menu-label">Suivi des loyers</span>
        <span class="profile-menu-arrow"><i data-lucide="chevron-right" class="icon icon--sm"></i></span>
      </a>
      <a class="profile-menu-item" href="#mes-annonces">
        <span class="profile-menu-icon"><i data-lucide="building-2" class="icon"></i></span>
        <span class="profile-menu-label">Mes annonces</span>
        <span class="profile-menu-arrow"><i data-lucide="chevron-right" class="icon icon--sm"></i></span>
      </a>
      <a class="profile-menu-item" href="#contrats">
        <span class="profile-menu-icon"><i data-lucide="file-text" class="icon"></i></span>
        <span class="profile-menu-label">Contrats & baux</span>
        <span class="profile-menu-arrow"><i data-lucide="chevron-right" class="icon icon--sm"></i></span>
      </a>
      <a class="profile-menu-item" href="#boost">
        <span class="profile-menu-icon"><i data-lucide="zap" class="icon"></i></span>
        <span class="profile-menu-label">Boost & visibilité</span>
        <span class="profile-menu-arrow"><i data-lucide="chevron-right" class="icon icon--sm"></i></span>
      </a>
      ${profile.role === 'admin' ? `
      <a class="profile-menu-item" href="#admin">
        <span class="profile-menu-icon"><i data-lucide="settings" class="icon"></i></span>
        <span class="profile-menu-label">Administration</span>
        <span class="profile-menu-arrow"><i data-lucide="chevron-right" class="icon icon--sm"></i></span>
      </a>` : ''}
    </div>` : `
    <div class="profile-menu">
      ${stats.bail ? `
      <a class="profile-menu-item" href="#payment-loyer?bail_id=${stats.bail.id}">
        <span class="profile-menu-icon"><i data-lucide="credit-card" class="icon"></i></span>
        <span class="profile-menu-label">Payer mon loyer</span>
        <span class="profile-menu-arrow"><i data-lucide="chevron-right" class="icon icon--sm"></i></span>
      </a>` : ''}
      <a class="profile-menu-item" href="#favoris">
        <span class="profile-menu-icon"><i data-lucide="heart" class="icon"></i></span>
        <span class="profile-menu-label">Mes favoris</span>
        <span class="profile-menu-arrow"><i data-lucide="chevron-right" class="icon icon--sm"></i></span>
      </a>
      <a class="profile-menu-item" href="#messages">
        <span class="profile-menu-icon"><i data-lucide="message-circle" class="icon"></i></span>
        <span class="profile-menu-label">Mes messages</span>
        <span class="profile-menu-arrow"><i data-lucide="chevron-right" class="icon icon--sm"></i></span>
      </a>
    </div>`}

    <div class="profile-menu" style="margin-top:12px">
      <div class="profile-menu-item" onclick="editProfile()">
        <span class="profile-menu-icon"><i data-lucide="pencil" class="icon"></i></span>
        <span class="profile-menu-label">Modifier mon profil</span>
        <span class="profile-menu-arrow"><i data-lucide="chevron-right" class="icon icon--sm"></i></span>
      </div>
      <div class="profile-menu-item danger" onclick="doSignOut()">
        <span class="profile-menu-icon"><i data-lucide="log-out" class="icon"></i></span>
        <span class="profile-menu-label">Se déconnecter</span>
      </div>
    </div>

    <div style="height:calc(var(--bottom-nav-h) + 24px)"></div>
  `;

  if (window.renderIcons) window.renderIcons();

  window.doSignOut = async () => {
    if (confirm('Se déconnecter ?')) await signOut();
  };

  window.editProfile = () => showToast('Modification du profil — bientôt disponible', 'info');
}

// ================================================================
// Init — Mes annonces
// ================================================================
export async function initMesAnnonces() {
  const root = document.getElementById('mes-annonces-root');
  if (!root) return;

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  root.innerHTML = '<div style="display:flex;justify-content:center;padding:40px"><div class="spinner spinner-lg"></div></div>';

  const { data, error } = await supabase
    .from('logements')
    .select('*')
    .eq('bailleur_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div><h3>Erreur</h3><p>${error.message}</p></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  if (!data?.length) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="building-2" class="icon"></i></div><h3>Aucune annonce</h3><p>Publiez votre première annonce !</p><button class="btn btn-primary" onclick="window.location.hash='#publish'">+ Publier</button></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  const statutLabels = {
    libre: { label: 'Libre', cls: 'badge-green' },
    loue: { label: 'Loué', cls: 'badge-amber' },
    en_moderation: { label: 'En modération', cls: 'badge-ink' },
    sous_reserve: { label: 'Sous réserve', cls: 'badge-amber' },
    archive: { label: 'Archivé', cls: 'badge-ink' },
  };

  root.innerHTML = data.map(l => {
    const st = statutLabels[l.statut] || { label: l.statut, cls: 'badge-ink' };
    return `<div class="boost-listing-item">
        <div style="width:56px;height:56px;border-radius:var(--radius-sm);overflow:hidden;background:var(--sand-dark);flex-shrink:0;display:flex;align-items:center;justify-content:center">
          ${l.photos?.[0] ? `<img src="${l.photos[0]}" style="width:100%;height:100%;object-fit:cover" loading="lazy">` : '<i data-lucide="home" class="icon icon--lg"></i>'}
        </div>
        <div class="boost-listing-info">
          <div class="boost-listing-title">${l.titre}</div>
          <div class="boost-listing-status" style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <span class="badge ${st.cls}">${st.label}</span>
            <span style="color:var(--ink-light)">· ${l.vues || 0} vues · ${l.contacts || 0} contacts</span>
          </div>
          <div style="font-size:0.875rem;font-weight:600;color:var(--green);margin-top:4px">${formatFCFA(l.loyer_mensuel)}/mois</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button class="btn btn-secondary btn-sm" onclick="window.location.hash='#listing-detail?id=${l.id}'">Voir</button>
          ${l.statut === 'libre' && !l.boost_actif ? `<button class="btn btn-amber btn-sm" onclick="window.location.hash='#boost'">Booster</button>` : ''}
        </div>
      </div>`;
  }).join('');
  if (window.renderIcons) window.renderIcons();
}

// ================================================================
// Init — Contrats
// ================================================================
export async function initContrats() {
  const root = document.getElementById('contrats-root');
  if (!root) return;

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  root.innerHTML = '<div style="display:flex;justify-content:center;padding:40px"><div class="spinner spinner-lg"></div></div>';

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isBailleur = profile?.role === 'bailleur' || profile?.role === 'agence';

  const { data, error } = await supabase
    .from('baux')
    .select('*, logements(titre, quartier), bailleur:profiles!bailleur_id(nom, prenom), locataire:profiles!locataire_id(nom, prenom)')
    .eq(isBailleur ? 'bailleur_id' : 'locataire_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="file-text" class="icon"></i></div><h3>Aucun contrat</h3><p>Vos baux apparaîtront ici.</p></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  const statutColors = { actif: 'badge-green', termine: 'badge-ink', resilie: 'badge-red' };

  root.innerHTML = data.map(bail => `<div class="contrat-card">
      <div class="contrat-card-header">
        <div>
          <div style="font-weight:600;color:var(--ink)">${bail.logements?.titre || 'Logement'}</div>
          <div style="font-size:0.8125rem;color:var(--ink-light)">${bail.logements?.quartier || ''}</div>
        </div>
        <span class="badge ${statutColors[bail.statut] || 'badge-ink'}">${bail.statut}</span>
      </div>
      <div class="contrat-card-parties">
        <span style="display:flex;align-items:center;gap:4px"><i data-lucide="key" class="icon icon--sm"></i> ${bail.bailleur?.prenom} ${bail.bailleur?.nom}</span>
        <span>↔</span>
        <span style="display:flex;align-items:center;gap:4px"><i data-lucide="user" class="icon icon--sm"></i> ${bail.locataire?.prenom} ${bail.locataire?.nom}</span>
      </div>
      <div style="margin-top:10px;font-size:0.875rem;color:var(--ink-mid);display:flex;align-items:center;gap:4px">
        <i data-lucide="calendar" class="icon icon--sm"></i> Du ${formatDateShort(bail.date_debut)}${bail.date_fin ? ` au ${formatDateShort(bail.date_fin)}` : ''}
      </div>
      <div style="font-weight:700;color:var(--green);margin-top:4px">${formatFCFA(bail.loyer_mensuel)}/mois · Caution ${formatFCFA(bail.caution_montant)}</div>
      ${bail.statut === 'actif' && isBailleur ? `
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="genContrat('${bail.id}')"><i data-lucide="file-text" class="icon icon--sm"></i> Générer contrat IA</button>
        ${bail.contrat_pdf_url ? `<a href="${bail.contrat_pdf_url}" target="_blank" class="btn btn-secondary btn-sm"><i data-lucide="download" class="icon icon--sm"></i> Télécharger</a>` : ''}
      </div>` : ''}
    </div>
  `).join('');
  if (window.renderIcons) window.renderIcons();

  window.genContrat = async (bailId) => {
    showToast('Génération du contrat en cours...', 'info', 5000);
    try {
      const { data: result } = await supabase.functions.invoke('gemini-contrat', { body: { bail_id: bailId } });
      if (result?.contrat) {
        showToast('Contrat généré avec succès !', 'success');
      }
    } catch {
      showToast('Erreur lors de la génération', 'error');
    }
  };
}

// ================================================================
// Init — Boost
// ================================================================
export async function initBoost() {
  const root = document.getElementById('boost-root');
  if (!root) return;

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  const { data: logements } = await supabase
    .from('logements')
    .select('id, titre, boost_actif, boost_type, boost_expire_le, statut')
    .eq('bailleur_id', user.id)
    .neq('statut', 'archive');

  const boostOffers = [
    { type: 'semaine', icon: 'zap', name: 'Boost Semaine', desc: '7 jours en priorité', prix: 2000 },
    { type: 'mois', icon: 'rocket', name: 'Boost Mois', desc: '30 jours en priorité', prix: 6000 },
    { type: 'alerte_push', icon: 'bell', name: 'Alerte Push', desc: 'Notifié aux locataires actifs', prix: 1000 },
    { type: 'homepage', icon: 'sparkles', name: 'À la une', desc: 'Section homepage pendant 7j', prix: 3000 },
    { type: 'pack_rentree', icon: 'graduation-cap', name: 'Pack Rentrée UAC', desc: 'Juillet–Septembre uniquement', prix: 4500, special: true },
  ];

  root.innerHTML = `
    <div style="padding:16px">
      <h3 style="margin-bottom:16px">Mes annonces</h3>
      ${(logements || []).map(l => `
        <div class="boost-listing-item">
          <div><i data-lucide="home" class="icon icon--lg"></i></div>
          <div class="boost-listing-info">
            <div class="boost-listing-title">${l.titre}</div>
            <div class="boost-listing-status" style="display:flex;align-items:center;gap:4px">${l.boost_actif ? `<i data-lucide="zap" class="icon icon--sm"></i> Boosté jusqu'au ${formatDateShort(l.boost_expire_le)}` : 'Pas de boost actif'}</div>
          </div>
        </div>
      `).join('') || '<p style="color:var(--ink-light);text-align:center;padding:20px">Aucune annonce</p>'}
    </div>

    <div style="padding:0 16px 16px">
      <h3 style="margin-bottom:16px">Offres de boost</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${boostOffers.map(offer => `
          <div class="boost-card ${offer.special ? 'featured' : ''}">
            <div class="boost-card-icon"><i data-lucide="${offer.icon}" class="icon icon--lg"></i></div>
            <div class="boost-card-info">
              <div class="boost-card-name">${offer.name}</div>
              <div class="boost-card-desc">${offer.desc}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
              <div class="boost-card-price">${formatFCFA(offer.prix)}</div>
              <button class="btn btn-primary btn-sm" onclick="activerBoost('${offer.type}',${offer.prix})">Activer</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <div style="height:32px"></div>
  `;
  if (window.renderIcons) window.renderIcons();

  window.activerBoost = (type, prix) => {
    if (!logements?.length) { showToast('Publiez d\'abord une annonce', 'warning'); return; }
    const logementId = logements[0].id;
    window.location.hash = `#payment-caution?logement_id=${logementId}&type=boost&montant=${prix}`;
  };
}
