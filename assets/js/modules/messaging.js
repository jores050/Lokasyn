// ================================================================
// LocaSyn — messaging.js
// Chat, liste conversations, RDV bannière épinglée, Realtime
// ================================================================

import supabase from '../supabase.js';
import { initiales, dateRelative, truncate, showToast, sanitizeMessage, formatFCFA, avatarColor } from '../utils.js';
import { getCurrentUser } from '../auth.js';

let realtimeChannel  = null;
let activeRdvChannel = null;
let rdvExpiryTimer   = null;

const isDesktop = () => window.innerWidth >= 1024;

// ================================================================
// Envoyer un message texte
// ================================================================
export async function sendMessage(conversationId, contenu, type = 'texte', metadata = null) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Non connecté');

  const sanitized = type === 'texte' ? sanitizeMessage(contenu) : contenu;

  const { data, error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    expediteur_id: user.id,
    contenu: sanitized,
    type,
    metadata,
  }).select().single();

  if (error) throw new Error(error.message);

  await supabase.from('conversations')
    .update({ derniere_activite: new Date().toISOString() })
    .eq('id', conversationId);

  return data;
}

// ================================================================
// Statuts RDV : actif vs terminal
// ================================================================
const STATUTS_TERMINAUX = ['annule_confirme', 'refuse'];

function rdvEstActif(rdv) {
  if (!rdv) return false;
  if (STATUTS_TERMINAUX.includes(rdv.statut)) return false;
  if (rdv.statut === 'effectue') {
    const expire = rdv.fenetre_contestation_expire_le
      && new Date(rdv.fenetre_contestation_expire_le) < new Date();
    return !expire;
  }
  return true; // en_attente, confirme, annule_demande
}

export async function peutCreerNouveauRdv(conversationId) {
  const { data: rdvs, error } = await supabase
    .from('rendez_vous')
    .select('id, statut, fenetre_contestation_expire_le')
    .eq('conversation_id', conversationId);

  if (error) { console.error('[RDV-VERROU]', error); return false; }
  return !(rdvs || []).some(rdvEstActif);
}

// ================================================================
// Bannière RDV épinglée
// ================================================================
function afficherBanniere(rdv, userId) {
  const el = document.getElementById('rdvBanniere');
  if (!el) return;
  el.innerHTML = renderRdvCard(rdv, userId);
  el.style.display = 'block';
  if (window.renderIcons) window.renderIcons();
}

function masquerBanniere() {
  const el = document.getElementById('rdvBanniere');
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
}

// ================================================================
// Trace historique (RDV terminé → une ligne dans le flux)
// ================================================================
function renderTraceRdvHistorique(rdv) {
  const labels = {
    annule_confirme: `Visite annulée — ${formatDateFr(rdv.date_visite)}`,
    refuse:          'Demande de visite refusée',
    effectue:        `Visite effectuée — ${formatDateFr(rdv.date_visite)}`,
  };
  return `<div class="msg msg--system" data-rdv-trace="${rdv.id}">
    <i data-lucide="check" class="icon icon--sm"></i>
    ${labels[rdv.statut] || 'Visite terminée'}
  </div>`;
}

function insererTraceHistorique(rdv) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  if (container.querySelector(`[data-rdv-trace="${rdv.id}"]`)) return;
  container.insertAdjacentHTML('beforeend', renderTraceRdvHistorique(rdv));
  if (window.renderIcons) window.renderIcons();
}

// ================================================================
// Chargement initial des RDV du chat
// ================================================================
async function chargerEtRenderRdvDuChat(conversationId, userId) {
  const { data: rdvs, error } = await supabase
    .from('rendez_vous')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) { console.error('[RDV-CHAT]', error); return; }

  const rdvActif     = (rdvs || []).find(rdvEstActif);
  const rdvsTermines = (rdvs || []).filter(r => !rdvEstActif(r));

  rdvsTermines.forEach(rdv => insererTraceHistorique(rdv));

  if (rdvActif) {
    afficherBanniere(rdvActif, userId);
    demarrerVerifExpiryBanniere(rdvActif, userId);
  } else {
    masquerBanniere();
  }
}

// Vérification périodique — RDV "effectue" dont la fenêtre vient d'expirer côté temps
function demarrerVerifExpiryBanniere(rdvActif, userId) {
  if (rdvExpiryTimer) { clearInterval(rdvExpiryTimer); rdvExpiryTimer = null; }
  if (rdvActif.statut !== 'effectue') return;

  rdvExpiryTimer = setInterval(async () => {
    const banniere = document.getElementById('rdvBanniere');
    if (!banniere || banniere.style.display === 'none') {
      clearInterval(rdvExpiryTimer); rdvExpiryTimer = null; return;
    }
    const rdvId = banniere.querySelector('[data-rdv-id]')?.dataset.rdvId;
    if (!rdvId) return;

    const { data: rdv } = await supabase.from('rendez_vous').select('*').eq('id', rdvId).single();
    if (rdv && !rdvEstActif(rdv)) {
      masquerBanniere();
      insererTraceHistorique(rdv);
      clearInterval(rdvExpiryTimer); rdvExpiryTimer = null;
    }
  }, 60000);
}

// ================================================================
// Désactivation visuelle du bouton RDV selon verrou
// ================================================================
function mettreAJourEtatBoutonRdv(conversationId) {
  peutCreerNouveauRdv(conversationId).then(peutCreer => {
    const btn = document.querySelector('.rdv-trigger');
    if (!btn) return;
    btn.disabled = !peutCreer;
    btn.title = peutCreer
      ? 'Proposer un créneau de visite'
      : 'Une visite est déjà en cours pour cette conversation';
  });
}

// ================================================================
// Abonnements Realtime
// ================================================================
export function subscribeToMessages(conversationId, onMessage) {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel(`conv:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
    }, payload => onMessage(payload.new))
    .subscribe();
  return realtimeChannel;
}

function subscribeToRdvChanges(conversationId, userId) {
  if (activeRdvChannel) supabase.removeChannel(activeRdvChannel);
  activeRdvChannel = supabase
    .channel(`rdv:${conversationId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'rendez_vous',
      filter: `conversation_id=eq.${conversationId}`,
    }, payload => {
      const rdv = payload.new;
      if (rdvEstActif(rdv)) {
        afficherBanniere(rdv, userId);
        demarrerVerifExpiryBanniere(rdv, userId);
      } else {
        masquerBanniere();
        insererTraceHistorique(rdv);
        if (rdvExpiryTimer) { clearInterval(rdvExpiryTimer); rdvExpiryTimer = null; }
      }
      mettreAJourEtatBoutonRdv(conversationId);
    })
    .subscribe();
  return activeRdvChannel;
}

function cleanupChannels() {
  if (realtimeChannel)  { supabase.removeChannel(realtimeChannel);  realtimeChannel  = null; }
  if (activeRdvChannel) { supabase.removeChannel(activeRdvChannel); activeRdvChannel = null; }
  if (rdvExpiryTimer)   { clearInterval(rdvExpiryTimer);            rdvExpiryTimer   = null; }
}

// ================================================================
// Utilitaires
// ================================================================
function formatDateFr(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const mois = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  return `${parseInt(d, 10)} ${mois[parseInt(m, 10) - 1]} ${y}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

// ================================================================
// Rendu bannière RDV (états actifs uniquement)
// ================================================================
function renderRdvCard(rdv, currentUserId) {
  if (!rdv) return '';
  const estLocataire = rdv.demandeur_id === currentUserId;
  const estBailleur  = rdv.bailleur_id  === currentUserId;

  switch (rdv.statut) {
    case 'en_attente':     return renderRdvEnAttente(rdv, estLocataire, estBailleur);
    case 'confirme':       return renderRdvConfirme(rdv, estLocataire);
    case 'annule_demande': return renderRdvAnnulationDemandee(rdv, estBailleur);
    case 'effectue':       return renderRdvEffectueActif(rdv, estBailleur);
    default: return '';
  }
}

function renderRdvEnAttente(rdv, estLocataire, estBailleur) {
  const cls = 'rdv-banniere-card rdv-banniere-card--neutral';
  if (estBailleur) {
    return `<div class="${cls}" data-rdv-id="${rdv.id}">
      <div class="rdv-card-header"><i data-lucide="calendar" class="icon icon--sm"></i> Visite proposée</div>
      <div class="rdv-card-detail">${formatDateFr(rdv.date_visite)} à ${rdv.heure_visite || '—'}</div>
      ${rdv.prix_visite ? `<div class="programmation-prix">${formatFCFA(rdv.prix_visite)}</div>` : ''}
      <div class="rdv-card-detail" style="margin-top:4px">En attente de confirmation du locataire</div>
    </div>`;
  }
  const btnLabel = rdv.prix_visite
    ? `Payer et confirmer (${formatFCFA(rdv.prix_visite)})`
    : 'Confirmer la visite';
  return `<div class="${cls}" data-rdv-id="${rdv.id}">
    <div class="rdv-card-header"><i data-lucide="calendar" class="icon icon--sm"></i> Visite proposée</div>
    <div class="rdv-card-detail" style="margin-bottom:8px">${formatDateFr(rdv.date_visite)} à ${rdv.heure_visite || '—'}</div>
    ${rdv.prix_visite ? `<div class="programmation-prix">${formatFCFA(rdv.prix_visite)}</div>` : ''}
    <button class="btn btn-primary" style="width:100%;margin-top:10px"
            onclick="payerEtConfirmerRdv('${rdv.id}', ${rdv.prix_visite || 0})">
      ${btnLabel}
    </button>
    <div class="programmation-rassurance">
      <i data-lucide="shield-check" class="icon icon--sm"></i>
      Vous pouvez annuler à tout moment avant la visite
    </div>
  </div>`;
}

function renderRdvConfirme(rdv, estLocataire) {
  return `<div class="rdv-banniere-card rdv-banniere-card--confirme" data-rdv-id="${rdv.id}">
    <div class="rdv-card-header"><i data-lucide="badge-check" class="icon icon--sm"></i> Visite confirmée</div>
    <div class="rdv-card-detail">${formatDateFr(rdv.date_visite)} à ${rdv.heure_visite || '—'}</div>
    ${estLocataire ? `
      <div class="rdv-card-actions" style="margin-top:10px">
        <button class="rdv-decline" onclick="demanderAnnulationRdv('${rdv.id}')">
          <i data-lucide="x-circle" class="icon icon--sm"></i> Annuler
        </button>
        <button class="rdv-accept" onclick="declarerVisiteEffectuee('${rdv.id}')">
          <i data-lucide="check-circle" class="icon icon--sm"></i> Visite effectuée
        </button>
      </div>` : `<div class="rdv-card-detail" style="margin-top:4px">En attente de la date</div>`}
  </div>`;
}

function renderRdvAnnulationDemandee(rdv, estBailleur) {
  if (estBailleur) {
    return `<div class="rdv-banniere-card rdv-banniere-card--alerte" data-rdv-id="${rdv.id}">
      <div class="rdv-card-header"><i data-lucide="alert-circle" class="icon icon--sm"></i> Demande d'annulation</div>
      <div class="rdv-card-detail">Le locataire souhaite annuler — ${formatDateFr(rdv.date_visite)}</div>
      <div class="rdv-card-actions" style="margin-top:10px">
        <button class="rdv-accept" id="btn-confirm-annul-${rdv.id}"
                onclick="confirmerAnnulation('${rdv.id}', this)">Confirmer l'annulation</button>
        <button class="rdv-decline" onclick="refuserAnnulation('${rdv.id}')">Refuser</button>
      </div>
    </div>`;
  }
  return `<div class="rdv-banniere-card rdv-banniere-card--alerte" data-rdv-id="${rdv.id}">
    <div class="rdv-card-header"><i data-lucide="clock" class="icon icon--sm"></i> Annulation en attente</div>
    <div class="rdv-card-detail">Le bailleur doit confirmer votre demande d'annulation</div>
  </div>`;
}

function renderRdvEffectueActif(rdv, estBailleur) {
  const estPayant = rdv.prix_visite && rdv.prix_visite > 0;
  return `<div class="rdv-banniere-card rdv-banniere-card--confirme" data-rdv-id="${rdv.id}">
    <div class="rdv-card-header"><i data-lucide="check-circle" class="icon icon--sm"></i> Visite effectuée</div>
    <div class="rdv-card-detail">${formatDateFr(rdv.date_visite)}</div>
    ${estBailleur ? `
      <div class="rdv-card-detail" style="margin-top:4px">${estPayant ? 'Paiement libéré automatiquement sous 24h sauf contestation' : 'Confirmation enregistrée'}</div>
      <button class="btn-link" style="margin-top:8px;font-size:0.8125rem" onclick="ouvrirContestation('${rdv.id}')">
        Cette visite n'a pas eu lieu — contester
      </button>` : `<div class="rdv-card-detail" style="margin-top:4px">${estPayant ? 'Paiement en cours de libération' : 'Visite confirmée'}</div>`}
  </div>`;
}

// ================================================================
// Rendu message texte / types hérités (backward compat)
// ================================================================
function renderMessage(msg, currentUserId) {
  if (!msg) return '';
  const isMine = msg.expediteur_id === currentUserId;
  const time = dateRelative(msg.created_at);
  const meta = msg.metadata || {};

  if (msg.type === 'systeme') {
    if (!msg.contenu) return '';
    return `<div class="msg msg--system"><span>${msg.contenu}</span><div class="msg-time">${time}</div></div>`;
  }

  if (['rdv_demande','rdv_confirme','rdv_programmation','annulation_demandee','visite_declaree'].includes(msg.type)) {
    const labels = {
      rdv_demande: 'Demande de visite', rdv_confirme: 'Visite confirmée',
      rdv_programmation: 'Programmation de visite', annulation_demandee: "Demande d'annulation",
      visite_declaree: 'Visite déclarée effectuée',
    };
    const icons = {
      rdv_demande: 'calendar', rdv_confirme: 'badge-check',
      rdv_programmation: 'calendar-check', annulation_demandee: 'alert-circle', visite_declaree: 'check-circle',
    };
    return `<div class="msg msg--system">
      <div class="msg-title" style="display:flex;align-items:center;gap:6px">
        <i data-lucide="${icons[msg.type] || 'info'}" class="icon icon--sm"></i>
        ${labels[msg.type] || msg.type}
      </div>
      ${meta.date_visite || meta.date ? `<div class="msg-detail">${formatDateFr(meta.date_visite || meta.date)} à ${meta.heure_visite || meta.heure || '—'}</div>` : ''}
      <div class="msg-time">${time}</div>
    </div>`;
  }

  if (msg.type === 'lien_paiement') {
    return `<div class="msg msg--system">
      <div class="msg-title" style="display:flex;align-items:center;gap:6px"><i data-lucide="wallet" class="icon icon--sm"></i> Paiement en attente</div>
      <div class="msg-detail">${meta.message || `Loyer ${meta.mois}`} — ${formatFCFA(meta.montant)}</div>
      ${!isMine ? `<div class="msg-actions"><button class="btn btn-primary btn-sm" onclick="payerLoyer('${meta.bail_id}','${meta.mois}',${meta.montant})">Payer via MoMo</button></div>` : ''}
      <div class="msg-time">${time}</div>
    </div>`;
  }

  if (msg.type === 'image') {
    return `<div class="msg ${isMine ? 'msg--me' : 'msg--them'}" style="padding:4px;background:transparent;border:none;box-shadow:none">
      <img src="${msg.contenu}" style="max-width:200px;border-radius:var(--radius-md);cursor:pointer;display:block" onclick="window.open('${msg.contenu}','_blank')" loading="lazy">
      <div class="msg-time">${time}</div>
    </div>`;
  }

  if (!msg.contenu) return '';

  return `<div class="msg ${isMine ? 'msg--me' : 'msg--them'}">
    ${escapeHtml(msg.contenu)}
    <div class="msg-time">${time}${isMine && msg.lu ? ' · Lu' : ''}</div>
  </div>`;
}

// ================================================================
// Charger uniquement les messages texte
// ================================================================
async function loadChatContent(convId, userId, container) {
  const { data: messages, error } = await supabase
    .from('messages').select('*').eq('conversation_id', convId)
    .order('created_at', { ascending: true }).limit(100);

  if (error) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ink-light)">Erreur : ${error.message}</div>`;
    return;
  }

  if (!messages?.length) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--ink-light);font-size:0.875rem;font-style:italic">Démarrez la conversation !</div>`;
    return;
  }

  container.innerHTML = messages.map(m => renderMessage(m, userId)).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; }));
}

// ================================================================
// Composer HTML (bouton rdv-trigger côté bailleur)
// ================================================================
function composerHtml(isBailleur) {
  const rdvBtn = isBailleur
    ? `<button class="composer-action rdv-trigger" onclick="ouvrirFormulaireRdv()" title="Proposer un créneau de visite">
         <i data-lucide="calendar-plus" class="icon"></i>
       </button>`
    : '';
  return `
    ${rdvBtn}
    <textarea class="composer-input" id="msg-input" placeholder="Votre message..." rows="1" onkeydown="handleMsgKey(event)"></textarea>
    <button class="composer-send" id="send-btn" onclick="sendMsg()"><i data-lucide="send" class="icon" style="color:white"></i></button>
  `;
}

// HTML interne du panneau de chat (mobile + desktop)
function chatPanelInnerHtml(conv, isBailleur, other, otherNom, inis, color, backBtn) {
  return `
    <header class="chat-col__header">
      ${backBtn ? `<button onclick="history.back()" style="background:none;border:none;cursor:pointer;padding:4px;flex-shrink:0"><i data-lucide="arrow-left" class="icon icon--lg"></i></button>` : ''}
      <div class="avatar avatar-sm" style="background:${color}">${other?.photo_url ? `<img src="${other.photo_url}">` : inis}</div>
      <div class="chat-header-info">
        <div class="chat-header-name">${otherNom}</div>
        <div class="chat-header-status"><span class="online-dot"></span> En ligne</div>
      </div>
      <button onclick="window.location.hash='#listing-detail?id=${conv.logements?.id}'" style="background:none;border:none;cursor:pointer;padding:4px;margin-left:auto"><i data-lucide="home" class="icon icon--lg"></i></button>
    </header>
    <div class="chat-col__context">
      <div class="chat-logement-bar" onclick="window.location.hash='#listing-detail?id=${conv.logements?.id}'">
        <i data-lucide="home" class="icon icon--sm"></i>
        <span class="chat-logement-bar-text">${conv.logements?.titre || 'Logement'} · ${conv.logements?.ref_interne || ''} · ${conv.logements?.quartier || ''}</span>
        <i data-lucide="chevron-right" class="icon icon--sm" style="color:var(--color-green);margin-left:auto"></i>
      </div>
      <div class="security-notice" style="display:flex;align-items:center;gap:6px"><i data-lucide="lock" class="icon icon--sm"></i> Coordonnées masquées jusqu'à la signature du bail</div>
    </div>
    <div class="chat-col__messages" id="chatMessages"></div>
    <div class="rdv-banniere" id="rdvBanniere" style="display:none;"></div>
    <footer class="chat-col__composer">${composerHtml(isBailleur)}</footer>
  `;
}

// ================================================================
// Desktop: squelette deux colonnes
// ================================================================
function renderDesktopLayout() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div class="messages-shell" id="messages-shell">
      <aside class="conversations-col" id="conversations-list">
        <div style="display:flex;justify-content:center;padding:40px"><div class="spinner"></div></div>
      </aside>
      <section class="chat-col" id="chat-col">
        <div class="messages-empty-panel">
          <div class="empty-icon"><i data-lucide="message-circle" class="icon"></i></div>
          <h3>Sélectionnez une conversation</h3>
          <p>Choisissez une conversation dans la liste</p>
        </div>
      </section>
    </div>
  `;
}

// ================================================================
// Liste des conversations
// ================================================================
async function buildConversationsList(user, listEl, activeConvId = null) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id, derniere_activite, statut,
        logements(id, titre, quartier, ref_interne),
        locataire:profiles!locataire_id(id, nom, prenom, photo_url),
        bailleur:profiles!bailleur_id(id, nom, prenom, photo_url)
      `)
      .or(`locataire_id.eq.${user.id},bailleur_id.eq.${user.id}`)
      .order('derniere_activite', { ascending: false });

    if (error) throw error;

    if (!data?.length) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-icon"><i data-lucide="message-circle" class="icon"></i></div>
        <h3>Aucune conversation</h3>
        <p>Trouvez un logement et contactez un bailleur !</p>
        <button class="btn btn-primary" onclick="window.location.hash='#home'">Explorer</button>
      </div>`;
      if (window.renderIcons) window.renderIcons();
      return;
    }

    const { data: unreads } = await supabase
      .from('messages').select('conversation_id')
      .eq('lu', false).neq('expediteur_id', user.id);

    const unreadMap = {};
    (unreads || []).forEach(m => { unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1; });

    const convIds = data.map(c => c.id);
    const { data: lastMsgs } = await supabase
      .from('messages').select('conversation_id, contenu, type, created_at, expediteur_id')
      .in('conversation_id', convIds).order('created_at', { ascending: false });

    const lastMsgMap = {};
    (lastMsgs || []).forEach(m => { if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m; });

    listEl.innerHTML = data.map(conv => {
      const isLocataire = conv.locataire?.id === user.id;
      const other = isLocataire ? conv.bailleur : conv.locataire;
      if (!other) return '';

      const nom    = `${other.prenom || ''} ${other.nom || ''}`.trim();
      const inis   = initiales(other.nom, other.prenom);
      const color  = avatarColor(nom);
      const lastMsg = lastMsgMap[conv.id];
      const unread  = unreadMap[conv.id] || 0;
      const diffMs  = Date.now() - new Date(conv.derniere_activite).getTime();
      const isOnline = diffMs < 300000;

      let preview = 'Démarrez la conversation';
      if (lastMsg) {
        if (lastMsg.type === 'rdv_programmation')    preview = '<i data-lucide="calendar-plus" class="icon icon--sm"></i> Visite proposée';
        else if (lastMsg.type === 'rdv_confirme')    preview = '<i data-lucide="badge-check" class="icon icon--sm"></i> Visite confirmée';
        else if (lastMsg.type === 'rdv_demande')     preview = '<i data-lucide="calendar" class="icon icon--sm"></i> Demande de visite';
        else if (lastMsg.type === 'lien_paiement')   preview = '<i data-lucide="wallet" class="icon icon--sm"></i> Lien de paiement';
        else if (lastMsg.type === 'image')           preview = '<i data-lucide="camera" class="icon icon--sm"></i> Photo';
        else if (lastMsg.contenu) preview = truncate(lastMsg.contenu, 55);
      }

      const isActive = conv.id === activeConvId;
      return `
        <div class="conv-item${isActive ? ' active' : ''}" data-conv-id="${conv.id}" onclick="openConv('${conv.id}')">
          <div class="avatar" style="background:${color};position:relative">
            ${other.photo_url ? `<img src="${other.photo_url}" alt="${nom}">` : inis}
            ${isOnline ? `<span style="position:absolute;bottom:0;right:0;width:10px;height:10px;background:var(--green-mid);border-radius:50%;border:2px solid var(--white)"></span>` : ''}
          </div>
          <div class="conv-item-info">
            <div class="conv-item-top">
              <div class="conv-item-name">${nom}</div>
              <div class="conv-item-time">${lastMsg ? dateRelative(lastMsg.created_at) : ''}</div>
            </div>
            <div class="conv-item-logement" style="display:flex;align-items:center;gap:4px"><i data-lucide="home" class="icon icon--sm"></i> ${conv.logements?.titre || 'Logement'} · ${conv.logements?.ref_interne || ''}</div>
            <div class="conv-item-preview" style="${unread ? 'font-weight:600;color:var(--ink)' : ''}">${preview}</div>
          </div>
          ${unread ? `<div class="conv-item-badge">${unread}</div>` : ''}
        </div>`;
    }).join('');

  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div><h3>Erreur</h3><p>${err.message}</p></div>`;
  }
  if (window.renderIcons) window.renderIcons();
}

// ================================================================
// Initialisation du panneau de chat (partagé desktop + mobile)
// ================================================================
async function initChatSession(convId, user, container, backBtn) {
  const { data: conv, error } = await supabase
    .from('conversations')
    .select(`
      id, statut,
      logements(id, titre, quartier, ref_interne),
      locataire:profiles!locataire_id(id, nom, prenom, photo_url),
      bailleur:profiles!bailleur_id(id, nom, prenom, photo_url)
    `)
    .eq('id', convId)
    .single();

  if (error) {
    container.innerHTML = `<div class="messages-empty-panel"><div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div><h3>Erreur de chargement</h3><p>${error.message}</p></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }
  if (!conv) {
    container.innerHTML = `<div class="messages-empty-panel"><div class="empty-icon"><i data-lucide="frown" class="icon"></i></div><h3>Conversation introuvable</h3></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  const isBailleur = conv.bailleur?.id === user.id;
  const other      = isBailleur ? conv.locataire : conv.bailleur;
  const otherNom   = other ? `${other.prenom || ''} ${other.nom || ''}`.trim() : 'Interlocuteur';
  const inis       = other ? initiales(other.nom, other.prenom) : '?';
  const color      = avatarColor(otherNom);

  container.innerHTML = chatPanelInnerHtml(conv, isBailleur, other, otherNom, inis, color, backBtn);

  const msgContainer = document.getElementById('chatMessages');
  await loadChatContent(convId, user.id, msgContainer);
  await chargerEtRenderRdvDuChat(convId, user.id);
  mettreAJourEtatBoutonRdv(convId);
  if (window.renderIcons) window.renderIcons();

  await supabase.from('messages')
    .update({ lu: true, lu_le: new Date().toISOString() })
    .eq('conversation_id', convId).neq('expediteur_id', user.id).eq('lu', false);

  subscribeToMessages(convId, (newMsg) => {
    const list = document.getElementById('chatMessages');
    if (!list) return;
    const html = renderMessage(newMsg, user.id);
    if (html) list.insertAdjacentHTML('beforeend', html);
    if (window.renderIcons) window.renderIcons();
    requestAnimationFrame(() => requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; }));
    if (newMsg.expediteur_id !== user.id) {
      supabase.from('messages').update({ lu: true, lu_le: new Date().toISOString() }).eq('id', newMsg.id);
    }
  });

  subscribeToRdvChanges(convId, user.id);
  setupChatHandlers(convId, conv, user, isBailleur);
}

// Desktop: charger dans le panneau droit
async function loadChatInPanel(convId, user) {
  const panel = document.getElementById('chat-col');
  if (!panel) return;
  document.querySelectorAll('.conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.convId === convId);
  });
  panel.innerHTML = `<div style="display:flex;justify-content:center;padding:60px"><div class="spinner spinner-lg"></div></div>`;
  cleanupChannels();
  await initChatSession(convId, user, panel, false);
}

// ================================================================
// Handlers chat
// ================================================================
function setupChatHandlers(convId, conv, user, isBailleur) {

  window.sendMsg = async () => {
    const input = document.getElementById('msg-input');
    const text  = input?.value?.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('send-btn').disabled = true;
    try { await sendMessage(convId, text, 'texte'); }
    catch (err) { showToast(err.message, 'error'); }
    finally { document.getElementById('send-btn').disabled = false; }
  };

  window.handleMsgKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendMsg(); }
  };

  const input = document.getElementById('msg-input');
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

  window.payerLoyer = (bailId, mois, montant) => {
    window.location.hash = `#payment-loyer?bail_id=${bailId}&mois=${mois}&montant=${montant}`;
  };

  // ----------------------------------------------------------------
  // Bailleur : proposer un RDV
  // ----------------------------------------------------------------
  window.ouvrirFormulaireRdv = async () => {
    if (!isBailleur) return;

    const peutCreer = await peutCreerNouveauRdv(convId);
    if (!peutCreer) {
      showToast('Une visite est déjà en cours pour cette conversation', 'error');
      return;
    }

    document.getElementById('rdv-form-modal')?.remove();
    const today = new Date().toISOString().split('T')[0];
    const modal = document.createElement('div');
    modal.id = 'rdv-form-modal';
    modal.className = 'modal-overlay show';
    modal.innerHTML = `
      <div class="bottom-sheet">
        <div class="bottom-sheet-handle"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 style="font-size:1.125rem;font-weight:600">Proposer un créneau de visite</h3>
          <button onclick="document.getElementById('rdv-form-modal').remove()" style="background:none;border:none;cursor:pointer;padding:4px"><i data-lucide="x" class="icon"></i></button>
        </div>
        <div class="form-group">
          <div class="form-label">Date</div>
          <input class="form-input" type="date" id="rdv-date-input" min="${today}" />
        </div>
        <div class="form-group" style="margin-top:12px">
          <div class="form-label">Heure</div>
          <input class="form-input" type="time" id="rdv-heure-input" />
        </div>
        <button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="envoyerProgrammationRdv()">
          <i data-lucide="send" class="icon icon--sm"></i> Envoyer la programmation
        </button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    if (window.renderIcons) window.renderIcons();
  };

  window.envoyerProgrammationRdv = async () => {
    const date  = document.getElementById('rdv-date-input')?.value;
    const heure = document.getElementById('rdv-heure-input')?.value;
    if (!date || !heure) { showToast('Indiquez une date et une heure', 'error'); return; }

    const btn = document.querySelector('#rdv-form-modal .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      const { data: rdv, error: rdvErr } = await supabase.from('rendez_vous').insert({
        conversation_id: convId,
        logement_id: conv.logements?.id,
        demandeur_id: conv.locataire?.id,
        bailleur_id: user.id,
        date_visite: date,
        heure_visite: heure.length === 5 ? heure + ':00' : heure,
        statut: 'en_attente',
      }).select('*').single();

      if (rdvErr) {
        console.error('[RDV] Insert échoué:', rdvErr.message);
        showToast('Erreur : ' + rdvErr.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Envoyer la programmation'; }
        return;
      }

      document.getElementById('rdv-form-modal')?.remove();
      afficherBanniere(rdv, user.id);
      mettreAJourEtatBoutonRdv(convId);
      showToast('Programmation envoyée au locataire');

    } catch (err) {
      console.error('[RDV] envoyerProgrammationRdv:', err);
      showToast('Erreur lors de l\'envoi', 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Envoyer la programmation'; }
    }
  };

  // ----------------------------------------------------------------
  // Locataire : payer pour confirmer
  // ----------------------------------------------------------------
  window.payerEtConfirmerRdv = async (rdvId, montant) => {
    if (!montant || montant <= 0) { await confirmerRdvSansPaiement(rdvId, convId, user); return; }
    if (!window.openKkiapayWidget) { showToast('SDK de paiement non chargé', 'error'); return; }
    try {
      const { data: paiement, error: pErr } = await supabase.from('paiements').insert({
        logement_id: conv.logements?.id,
        payeur_id: user.id,
        beneficiaire_id: conv.bailleur?.id,
        type: 'frais_visite',
        montant,
        montant_bailleur: Math.round(montant * 0.9),
        montant_commission_plateforme: Math.round(montant * 0.1),
        statut: 'en_cours',
      }).select('id').single();

      if (pErr) throw new Error(pErr.message);
      window.__rdvPaiementCtx = { rdvId, paiementId: paiement.id, convId };

      window.openKkiapayWidget({
        amount: montant,
        api_key: window.__ENV?.KKIAPAY_PUBLIC_KEY || 'KKIAPAY_PUBLIC_KEY',
        sandbox: true,
        name: 'LocaSyn — Confirmation de visite',
        theme: '#0F5132',
        callback: window.location.origin + '/#rdv-payment-callback',
        data: JSON.stringify({ paiement_id: paiement.id, rdv_id: rdvId, type: 'frais_visite' }),
      });
    } catch (err) {
      console.error('[PAIEMENT-RDV]', err);
      showToast('Erreur lors de l\'initialisation du paiement', 'error');
    }
  };

  if (!window.__kkiapayRdvListenerAttached) {
    window.__kkiapayRdvListenerAttached = true;
    window.addEventListener('kkiapay-widget-event', async (event) => {
      if (event.detail.status !== 'SUCCESS') return;
      const ctx = window.__rdvPaiementCtx;
      if (!ctx) return;
      window.__rdvPaiementCtx = null;

      await supabase.from('paiements').update({
        statut: 'confirme',
        kkiapay_transaction_id: event.detail.transactionId,
      }).eq('id', ctx.paiementId);

      const { data: rdv } = await supabase.from('rendez_vous').update({
        statut: 'confirme',
        confirme_le: new Date().toISOString(),
        paiement_id: ctx.paiementId,
      }).eq('id', ctx.rdvId).select('*').single();

      if (rdv) afficherBanniere(rdv, user.id);
      showToast('Visite confirmée — vous pouvez annuler à tout moment avant la date');
    });
  }

  // ----------------------------------------------------------------
  // Locataire : demander annulation
  // ----------------------------------------------------------------
  window.demanderAnnulationRdv = async (rdvId) => {
    if (!confirm("Confirmer l'annulation de cette visite ? Le bailleur devra valider.")) return;
    const { data: rdv, error } = await supabase.from('rendez_vous')
      .update({ statut: 'annule_demande', annulation_demandee_le: new Date().toISOString() })
      .eq('id', rdvId).select('*').single();
    if (error) { showToast('Erreur', 'error'); return; }
    if (rdv) afficherBanniere(rdv, user.id);
    showToast("Demande d'annulation envoyée au bailleur");
  };

  // ----------------------------------------------------------------
  // Bailleur : confirmer l'annulation
  // ----------------------------------------------------------------
  window.confirmerAnnulation = async (rdvId, btnEl) => {
    if (btnEl?.disabled) return;
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Traitement...'; }

    const { data, error } = await supabase.functions.invoke('confirmer-annulation', {
      body: { rdv_id: rdvId, bailleur_id: user.id },
    });

    if (error || !data?.ok) {
      const msgs = {
        non_autorise:       'Non autorisé',
        statut_invalide:    `Statut invalide (actuel : ${data?.statut_actuel || '?'})`,
        rdv_introuvable:    'RDV introuvable',
        erreur_requete_rdv: 'Erreur de requête',
      };
      showToast(msgs[data?.error] || 'Erreur lors de la confirmation', 'error');
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = "Confirmer l'annulation"; }
      return;
    }
    // La bannière passe en trace historique via Realtime
    showToast(data.credit ? `Annulation confirmée — ${formatFCFA(data.montant)} crédités` : 'Annulation confirmée');
  };

  // ----------------------------------------------------------------
  // Bailleur : refuser l'annulation
  // ----------------------------------------------------------------
  window.refuserAnnulation = async (rdvId) => {
    const { data: rdv, error } = await supabase.from('rendez_vous')
      .update({ statut: 'confirme' }).eq('id', rdvId).select('*').single();
    if (error) { showToast('Erreur', 'error'); return; }
    if (rdv) afficherBanniere(rdv, user.id);
    showToast('Annulation refusée — le RDV reste confirmé');
  };

  // ----------------------------------------------------------------
  // Locataire : déclarer visite effectuée
  // ----------------------------------------------------------------
  window.declarerVisiteEffectuee = async (rdvId) => {
    if (!confirm('Confirmer que la visite a bien eu lieu ?')) return;
    const expireIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: rdv, error } = await supabase.from('rendez_vous').update({
      statut: 'effectue',
      visite_declaree_le: new Date().toISOString(),
      fenetre_contestation_expire_le: expireIso,
    }).eq('id', rdvId).select('*').single();
    if (error) { showToast('Erreur', 'error'); return; }
    if (rdv) { afficherBanniere(rdv, user.id); demarrerVerifExpiryBanniere(rdv, user.id); }
    showToast('Visite confirmée — paiement libéré sous 24h sauf contestation');
  };

  // ----------------------------------------------------------------
  // Bailleur : contester
  // ----------------------------------------------------------------
  window.ouvrirContestation = async (rdvId) => {
    const motif = prompt("Expliquez pourquoi cette visite n'a pas eu lieu selon vous :");
    if (!motif?.trim()) return;
    try {
      await supabase.from('rendez_vous').update({ contestation_motif: motif.trim() }).eq('id', rdvId);
      const { data: rdv } = await supabase.from('rendez_vous').select('paiement_id').eq('id', rdvId).single();
      if (rdv?.paiement_id) {
        await supabase.from('paiements').update({ statut: 'en_contestation' }).eq('id', rdv.paiement_id);
      }
      showToast("Contestation enregistrée — un administrateur va examiner le dossier");
    } catch (err) {
      showToast('Erreur', 'error');
    }
  };
}

async function confirmerRdvSansPaiement(rdvId, convId, user) {
  const { data: rdv, error } = await supabase.from('rendez_vous')
    .update({ statut: 'confirme', confirme_le: new Date().toISOString() })
    .eq('id', rdvId).select('*').single();
  if (error) { showToast('Erreur', 'error'); return; }
  if (rdv) afficherBanniere(rdv, user.id);
  showToast('Visite confirmée');
}

// ================================================================
// Init — Liste conversations
// ================================================================
export async function initMessages() {
  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  if (isDesktop()) {
    renderDesktopLayout();
    window.openConv = (convId) => {
      history.pushState(null, '', `#chat?id=${convId}`);
      loadChatInPanel(convId, user);
    };
    const listEl = document.getElementById('conversations-list');
    if (listEl) await buildConversationsList(user, listEl);
    return;
  }

  const list = document.getElementById('conversations-list');
  if (!list) return;
  window.openConv = (convId) => { window.location.hash = `#chat?id=${convId}`; };
  await buildConversationsList(user, list);
}

// ================================================================
// Init — Chat
// ================================================================
export async function initChat(params = {}) {
  const convId = params.id;
  if (!convId) { window.location.hash = '#messages'; return; }

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  cleanupChannels();

  if (isDesktop()) {
    const existingLayout = document.getElementById('messages-shell');
    if (!existingLayout) {
      renderDesktopLayout();
      window.openConv = (id) => {
        history.pushState(null, '', `#chat?id=${id}`);
        loadChatInPanel(id, user);
      };
      const listEl = document.getElementById('conversations-list');
      if (listEl) await buildConversationsList(user, listEl, convId);
    }
    await loadChatInPanel(convId, user);
    return;
  }

  // Mobile
  const root = document.getElementById('chat-root');
  if (!root) return;
  root.innerHTML = `<div style="display:flex;justify-content:center;padding:60px"><div class="spinner spinner-lg"></div></div>`;
  await initChatSession(convId, user, root, true);
}
