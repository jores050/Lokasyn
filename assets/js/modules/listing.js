// ================================================================
// LocaSyn — listing.js
// Détail logement
// ================================================================

import supabase from '../supabase.js';
import store from '../store.js';
import { formatFCFA, initiales, renderStars, logementIcon, LOGEMENT_LABEL, formatDate, showToast } from '../utils.js';
import { toggleFavori, getCurrentUser } from '../auth.js';
import { sendMessage, peutCreerNouveauRdv } from './messaging.js';


// ================================================================
// Incrémenter vues (debounce 30 min)
// ================================================================
async function incrementVues(id) {
  const key = `viewed_${id}`;
  const last = localStorage.getItem(key);
  if (last && Date.now() - parseInt(last) < 1800000) return;
  await supabase.rpc('increment_vues', { logement_id: id });
  localStorage.setItem(key, Date.now().toString());
}

// ================================================================
// Rendre les équipements
// ================================================================
function renderEquipements(equipements = []) {
  if (!equipements.length) return '';
  return `
    <div style="padding:0 16px 16px">
      <h3 style="margin-bottom:12px;font-size:1rem">Équipements</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${equipements.map(eq => `<span class="badge badge-ink"><i data-lucide="check" class="icon icon--sm"></i> ${eq}</span>`).join('')}
      </div>
    </div>
  `;
}

// ================================================================
// Rendre le template complet
// ================================================================
function renderDetail(logement, similarLogements = []) {
  const photos = logement.photos || [];
  const bailleur = logement.profiles;
  const isFav = store.isFavorite(logement.id);

  const badges = [];
  if (logement.boost_actif) badges.push('<span class="badge badge-amber"><i data-lucide="sparkles" class="icon icon--sm"></i> Mis en avant</span>');
  if (logement.verifie) badges.push('<span class="badge badge-green"><i data-lucide="badge-check" class="icon icon--sm"></i> Vérifié</span>');
  if (logement.badge_etudiant) badges.push('<span class="badge badge-ink"><i data-lucide="graduation-cap" class="icon icon--sm"></i> Étudiant OK</span>');
  if (logement.meuble) badges.push('<span class="badge badge-ink"><i data-lucide="sofa" class="icon icon--sm"></i> Meublé</span>');

  const typeBailLabel = {
    mensuel: 'Bail mensuel',
    annuel: 'Bail annuel',
    etudiant: 'Logement étudiant',
    court_terme: 'Court terme',
  };

  const cautiontxt = `Caution : ${logement.caution_mois} mois (${formatFCFA(logement.loyer_mensuel * logement.caution_mois)})`;

  const ctaButtons = `
    <button class="btn btn-secondary w-full" id="btn-visit" onclick="handleVisit()"><i data-lucide="calendar" class="icon icon--sm"></i> Planifier une visite</button>
    <button class="btn btn-primary w-full" id="btn-contact" onclick="handleContact()"><i data-lucide="message-circle" class="icon icon--sm"></i> Contacter le bailleur</button>
  `;

  const infoBlock = `
    ${badges.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${badges.join('')}</div>` : ''}
    <div class="listing-price">${formatFCFA(logement.loyer_mensuel)}<span style="font-size:1rem;font-weight:400;color:var(--ink-light)">/mois</span></div>
    <h1 class="listing-title">${logement.titre}</h1>
    <div class="listing-location" style="display:flex;align-items:center;gap:4px"><i data-lucide="map-pin" class="icon icon--sm"></i> ${logement.quartier}, ${logement.ville}</div>
    ${logement.surface_m2 ? `<div style="margin-top:6px;font-size:0.875rem;color:var(--ink-mid);display:flex;align-items:center;gap:4px"><i data-lucide="ruler" class="icon icon--sm"></i> ${logement.surface_m2} m²</div>` : ''}
    <div class="listing-caution" style="display:flex;align-items:center;gap:4px"><i data-lucide="alert-circle" class="icon icon--sm"></i> ${cautiontxt}</div>
    ${logement.type_bail ? `<div style="margin-top:10px;font-size:0.875rem;color:var(--ink-mid);display:flex;align-items:center;gap:4px"><i data-lucide="file-text" class="icon icon--sm"></i> ${typeBailLabel[logement.type_bail] || logement.type_bail}</div>` : ''}
    ${logement.disponible_le ? `<div style="margin-top:6px;font-size:0.875rem;color:var(--ink-mid);display:flex;align-items:center;gap:4px"><i data-lucide="calendar" class="icon icon--sm"></i> Disponible le ${formatDate(logement.disponible_le)}</div>` : ''}
  `;

  return `
    <!-- Header -->
    <div class="listing-detail-header" id="listing-header">
      <button onclick="history.back()" style="width:36px;height:36px;background:rgba(255,255,255,0.9);border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm)"><i data-lucide="arrow-left" class="icon"></i></button>
      <button id="fav-btn" onclick="handleFav()" style="width:36px;height:36px;background:rgba(255,255,255,0.9);border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm)">
        <i data-lucide="heart" class="icon" style="fill:${isFav ? 'currentColor' : 'none'};color:${isFav ? 'var(--color-red)' : 'inherit'}"></i>
      </button>
    </div>

    <!-- Layout 2 colonnes sur desktop, empilé sur mobile -->
    <div class="listing-detail-desktop">

      <!-- Colonne gauche : galerie + contenu -->
      <div class="listing-detail-left">

        <!-- Galerie photos -->
        <div class="listing-gallery" id="gallery">
          <div class="listing-gallery-track" id="gallery-track">
            ${photos.length
              ? photos.map((p, i) => `
                  <div class="listing-gallery-slide">
                    <img src="${p}" alt="Photo ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}"
                         onerror="this.style.display='none';this.parentElement.style.cssText='width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--sand-dark)'">
                  </div>`).join('')
              : `<div class="listing-gallery-slide"><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--sand-dark)">${logementIcon(logement.type)}</div></div>`
            }
          </div>
          ${photos.length > 1 ? `
            <button class="gallery-btn gallery-btn--prev" id="gallery-prev" aria-label="Photo précédente"><i data-lucide="chevron-left" class="icon icon--lg"></i></button>
            <button class="gallery-btn gallery-btn--next" id="gallery-next" aria-label="Photo suivante"><i data-lucide="chevron-right" class="icon icon--lg"></i></button>
            <div class="listing-gallery-counter">1 / ${photos.length}</div>
          ` : ''}
        </div>

        <!-- Infos (mobiles uniquement → reprises dans la colonne droite sur desktop) -->
        <div class="listing-info listing-info-mobile">${infoBlock}</div>

        <!-- Charges incluses -->
        ${(logement.eau_incluse || logement.electricite_incluse) ? `
        <div style="padding:0 16px 16px;display:flex;gap:8px">
          ${logement.eau_incluse ? '<span class="badge badge-green"><i data-lucide="droplet" class="icon icon--sm"></i> Eau incluse</span>' : ''}
          ${logement.electricite_incluse ? '<span class="badge badge-green"><i data-lucide="zap" class="icon icon--sm"></i> Électricité incluse</span>' : ''}
        </div>` : ''}

        <div style="height:1px;background:var(--border);margin:0 16px"></div>
        ${renderEquipements(logement.equipements || [])}

        ${logement.description ? `
        <div style="padding:0 16px 20px">
          <h3 style="margin-bottom:10px;font-size:1rem">Description</h3>
          <p style="font-size:0.9375rem;line-height:1.7;color:var(--ink-mid)">${logement.description}</p>
        </div>` : ''}

        <div style="height:1px;background:var(--border);margin:0 16px"></div>

        <!-- Carte -->
        ${logement.latitude && logement.longitude ? `
        <div style="padding:16px">
          <h3 style="margin-bottom:10px;font-size:1rem">Localisation</h3>
          <div id="detail-map" class="listing-map"></div>
        </div>` : ''}

        <div style="height:1px;background:var(--border);margin:0 16px"></div>

        <!-- Card bailleur -->
        <div style="padding:16px">
          <h3 style="margin-bottom:12px;font-size:1rem">Le bailleur</h3>
          ${bailleur ? `
          <div class="bailleur-card">
            <div class="avatar avatar-lg" style="background:var(--green)">
              ${bailleur.photo_url
                ? `<img src="${bailleur.photo_url}" alt="${bailleur.prenom}">`
                : initiales(bailleur.nom, bailleur.prenom)
              }
            </div>
            <div class="bailleur-card-info">
              <div class="bailleur-card-name">${bailleur.prenom} ${bailleur.nom}</div>
              <div class="bailleur-card-meta">${renderStars(bailleur.note_moyenne || 0)} ${bailleur.note_moyenne ? bailleur.note_moyenne.toFixed(1) : 'Nouveau'}</div>
              <div class="bailleur-card-meta">Répond généralement en moins de 24h</div>
            </div>
          </div>` : '<p style="color:var(--ink-light)">Informations bailleur indisponibles</p>'}
        </div>

        <!-- Similaires -->
        ${similarLogements.length ? `
        <div style="height:1px;background:var(--border);margin:0 16px"></div>
        <div class="section-header">
          <div class="section-title">Logements similaires</div>
        </div>
        <div class="scroll-x" id="similar-list" style="padding:0 16px 4px;gap:12px">
          ${similarLogements.map(l => {
            const photo = l.photos?.[0];
            const badges = [];
            if (l.boost_actif) badges.push('<span class="badge badge-orange"><i data-lucide="sparkles" class="icon icon--sm"></i> À la une</span>');
            if (l.verifie) badges.push('<span class="badge badge-green"><i data-lucide="badge-check" class="icon icon--sm"></i> Vérifié</span>');
            if (l.badge_etudiant) badges.push('<span class="badge badge-ink"><i data-lucide="graduation-cap" class="icon icon--sm"></i> Étudiant OK</span>');
            return `
            <div class="listing-card fade-in" onclick="window.location.hash='#listing-detail?id=${l.id}'" style="width:200px;min-width:200px;max-width:200px;flex-shrink:0">
              <div class="listing-card-photo">
                ${photo ? `<img src="${photo}" alt="${l.titre}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
                <div class="listing-card-placeholder" ${photo ? 'style="display:none"' : ''}>${logementIcon(l.type)}</div>
                ${badges.length ? `<div class="listing-card-badges">${badges.join('')}</div>` : ''}
              </div>
              <div class="listing-card-body">
                <div class="listing-card-price">${formatFCFA(l.loyer_mensuel)}<span style="font-size:0.75rem;font-weight:400;color:var(--ink-light)">/mois</span></div>
                <div class="listing-card-title">${l.titre}</div>
                <div class="listing-card-location"><i data-lucide="map-pin" class="icon icon--sm"></i> ${l.quartier}, ${l.ville}</div>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}

        <div style="height:calc(120px + env(safe-area-inset-bottom))" class="listing-cta-spacer"></div>
      </div>

      <!-- Colonne droite : fiche récap sticky (desktop) -->
      <div class="listing-detail-right">
        <div class="listing-cta-card">
          <div class="listing-cta-price">${formatFCFA(logement.loyer_mensuel)}<span style="font-size:1rem;font-weight:400;color:var(--ink-light)">/mois</span></div>
          <div class="listing-cta-price-sub">${cautiontxt}</div>
          <div class="listing-info" style="padding:0;margin-bottom:20px">${infoBlock}</div>
          <div style="display:flex;flex-direction:column;gap:10px">${ctaButtons}</div>
        </div>
      </div>

    </div><!-- /.listing-detail-desktop -->

    <!-- CTA sticky mobile uniquement -->
    <div class="listing-cta listing-cta-mobile">
      <button class="btn btn-secondary" id="btn-visit-m" onclick="handleVisit()"><i data-lucide="calendar" class="icon icon--sm"></i> Visiter</button>
      <button class="btn btn-primary" id="btn-contact-m" onclick="handleContact()"><i data-lucide="message-circle" class="icon icon--sm"></i> Contacter</button>
    </div>

  `;
}

// ================================================================
// Init
// ================================================================
export async function init(params = {}) {
  const root = document.getElementById('listing-detail-root');
  if (!root) return;

  const id = params.id;
  if (!id) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="frown" class="icon"></i></div><h3>Logement introuvable</h3><button class="btn btn-primary" onclick="history.back()">Retour</button></div>`;
    if (window.renderIcons) window.renderIcons();
    return;
  }

  try {
    // Charger logement + similaires en parallèle
    const [{ data: logement, error }, { data: similar }] = await Promise.all([
      supabase
        .from('logements')
        .select('*, profiles!bailleur_id(id, nom, prenom, note_moyenne, photo_url, nombre_avis)')
        .eq('id', id)
        .single(),
      supabase
        .from('logements')
        .select('id, titre, loyer_mensuel, quartier, type, photos')
        .eq('statut', 'libre')
        .neq('id', id)
        .limit(5),
    ]);

    if (error || !logement) {
      root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="frown" class="icon"></i></div><h3>Logement introuvable</h3><button class="btn btn-primary" onclick="history.back()">Retour</button></div>`;
      if (window.renderIcons) window.renderIcons();
      return;
    }

    root.innerHTML = renderDetail(logement, similar || []);
    if (window.renderIcons) window.renderIcons();

    // Galerie touch swipe
    initGallery(logement.photos || []);

    // Carte mini
    if (logement.latitude && logement.longitude && window.L) {
      const mapEl = document.getElementById('detail-map');
      if (mapEl) {
        const m = L.map('detail-map', { zoomControl: false, scrollWheelZoom: false })
          .setView([logement.latitude, logement.longitude], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
        L.marker([logement.latitude, logement.longitude]).addTo(m);
      }
    }

    // Header scroll
    const header = document.getElementById('listing-header');
    window.addEventListener('scroll', () => {
      header?.classList.toggle('scrolled', window.scrollY > 200);
    }, { passive: true });

    // Incrémenter vues
    incrementVues(id);

    // Handlers globaux
    window.handleFav = async () => {
      const isFav = await toggleFavori(id);
      const btn = document.getElementById('fav-btn');
      const svg = btn?.querySelector('svg');
      if (svg) {
        svg.style.fill = isFav ? 'currentColor' : 'none';
        svg.style.color = isFav ? 'var(--color-red)' : '';
      }
    };

    window.handleContact = async () => {
      const user = await getCurrentUser();
      if (!user) { window.location.hash = '#auth'; return; }
      if (user.id === logement.bailleur_id) { showToast('Vous êtes le bailleur de ce logement', 'warning'); return; }

      const btn = document.getElementById('btn-contact');
      const btnM = document.getElementById('btn-contact-m');
      if (btn) { btn.disabled = true; btn.textContent = '...'; }
      if (btnM) { btnM.disabled = true; btnM.textContent = '...'; }

      try {
        // maybeSingle() : ne crashe pas quand 0 conversation trouvée
        const { data: conv, error: searchErr } = await supabase
          .from('conversations')
          .select('id')
          .eq('logement_id', id)
          .eq('locataire_id', user.id)
          .maybeSingle();

        if (searchErr) {
          console.error('[CONTACT] Erreur recherche conversation:', searchErr);
          throw searchErr;
        }

        let conversationId = conv?.id;

        if (!conversationId) {
          const { data: newConv, error: insertErr } = await supabase
            .from('conversations')
            .insert({
              logement_id: id,
              locataire_id: user.id,
              bailleur_id: logement.bailleur_id,
            })
            .select('id')
            .single();

          if (insertErr) {
            console.error('[CONTACT] Erreur création conversation:', insertErr.message, insertErr);
            throw new Error(insertErr.message);
          }

          conversationId = newConv.id;
          void supabase.rpc('increment_contacts', { logement_id: id })
            .then(null, e => console.warn('[CONTACT] increment_contacts échoué:', e));
        }

        window.location.hash = `#chat?id=${conversationId}`;
      } catch (err) {
        console.error('[CONTACT] Exception:', err);
        showToast('Erreur lors de la mise en relation', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="message-circle" class="icon icon--sm"></i> Contacter le bailleur'; if (window.renderIcons) window.renderIcons(); }
        if (btnM) { btnM.disabled = false; btnM.innerHTML = '<i data-lucide="message-circle" class="icon icon--sm"></i> Contacter'; if (window.renderIcons) window.renderIcons(); }
      }
    };

    window.handleVisit = async () => {
      const user = await getCurrentUser();
      if (!user) { window.location.hash = '#auth'; return; }
      if (user.id === logement.bailleur_id) { showToast('Vous êtes le bailleur de ce logement', 'warning'); return; }

      const btn = document.getElementById('btn-visit');
      const btnM = document.getElementById('btn-visit-m');
      if (btn) { btn.disabled = true; btn.textContent = '...'; }
      if (btnM) { btnM.disabled = true; btnM.textContent = '...'; }

      try {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('logement_id', id)
          .eq('locataire_id', user.id)
          .maybeSingle();

        let convId = conv?.id;
        if (!convId) {
          const { data: newConv, error: insertErr } = await supabase
            .from('conversations')
            .insert({ logement_id: id, locataire_id: user.id, bailleur_id: logement.bailleur_id })
            .select('id').single();
          if (insertErr) throw insertErr;
          convId = newConv.id;
        }

        const peutCreer = await peutCreerNouveauRdv(convId);
        if (!peutCreer) {
          showToast('Vous avez déjà une visite en cours pour ce logement', 'error');
          window.location.hash = `#chat?id=${convId}`;
          return;
        }

        await sendMessage(convId, 'Bonjour, j\'aimerais visiter ce logement. Vous êtes disponible quand ?', 'texte');
        window.location.hash = `#chat?id=${convId}`;
      } catch (err) {
        showToast('Erreur lors de la demande de visite', 'error');
        console.error('[RDV] handleVisit:', err);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="calendar" class="icon icon--sm"></i> Planifier une visite'; if (window.renderIcons) window.renderIcons(); }
        if (btnM) { btnM.disabled = false; btnM.innerHTML = '<i data-lucide="calendar" class="icon icon--sm"></i> Visiter'; if (window.renderIcons) window.renderIcons(); }
      }
    };

  } catch (err) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div><h3>Erreur</h3><p>${err.message}</p><button class="btn btn-primary" onclick="history.back()">Retour</button></div>`;
    if (window.renderIcons) window.renderIcons();
  }
}


function initGallery(photos) {
  if (photos.length <= 1) return;
  const track = document.getElementById('gallery-track');
  const counter = document.querySelector('.listing-gallery-counter');
  const btnPrev = document.getElementById('gallery-prev');
  const btnNext = document.getElementById('gallery-next');
  if (!track) return;

  let current = 0;
  let startX = 0;
  let isDragging = false;
  let dragMoved = false;

  const goTo = (idx) => {
    current = Math.max(0, Math.min(photos.length - 1, idx));
    track.style.transform = `translateX(-${current * 100}%)`;
    if (counter) counter.textContent = `${current + 1} / ${photos.length}`;
    if (btnPrev) btnPrev.style.opacity = current === 0 ? '0.3' : '1';
    if (btnNext) btnNext.style.opacity = current === photos.length - 1 ? '0.3' : '1';
  };

  goTo(0);

  // Boutons prev/next
  btnPrev?.addEventListener('click', () => goTo(current - 1));
  btnNext?.addEventListener('click', () => goTo(current + 1));

  // Touch swipe (avec prévention du scroll page sur geste horizontal)
  let startY = 0;
  let touchLocked = false; // null=indéterminé, true=horizontal, false=vertical

  track.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    touchLocked = null;
    dragMoved = false;
  }, { passive: true });

  track.addEventListener('touchmove', e => {
    if (touchLocked === null) {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      touchLocked = dx > dy; // horizontal → on prend la main
    }
    if (touchLocked) e.preventDefault(); // bloque le scroll vertical
  }, { passive: false });

  track.addEventListener('touchend', e => {
    if (!touchLocked) return;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) goTo(diff > 0 ? current + 1 : current - 1);
  });

  // Mouse drag
  track.addEventListener('mousedown', e => { startX = e.clientX; isDragging = true; dragMoved = false; track.style.cursor = 'grabbing'; });
  track.addEventListener('mousemove', e => { if (isDragging && Math.abs(e.clientX - startX) > 5) dragMoved = true; });
  track.addEventListener('mouseup', e => {
    if (!isDragging) return;
    isDragging = false;
    track.style.cursor = 'grab';
    if (dragMoved) {
      const diff = startX - e.clientX;
      if (Math.abs(diff) > 40) goTo(diff > 0 ? current + 1 : current - 1);
    }
  });
  track.addEventListener('mouseleave', () => { isDragging = false; track.style.cursor = 'grab'; });
  track.style.cursor = 'grab';
}
