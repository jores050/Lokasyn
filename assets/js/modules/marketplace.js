// ================================================================
// LocaSyn — marketplace.js
// Accueil, recherche, listings, favoris
// ================================================================

import supabase from '../supabase.js';
import store from '../store.js';
import { formatFCFA, logementIcon, truncate, showToast, restoreScrollPosition, debounce } from '../utils.js';
import { toggleFavori, getCurrentUser, getCurrentProfile } from '../auth.js';

let currentFilters = {};
let currentOffset = 0;
const PAGE_SIZE = 8;

// ================================================================
// Rendu d'une card logement
// ================================================================
export function renderListingCard(logement, compact = false) {
  const isFav = store.isFavorite(logement.id);
  const photo = logement.photos?.[0];
  const bailleur = logement.profiles;

  const badges = [];
  if (logement.boost_actif) badges.push('<span class="badge badge-amber"><i data-lucide="sparkles" class="icon icon--sm"></i> Mis en avant</span>');
  if (logement.verifie) badges.push('<span class="badge badge-green"><i data-lucide="badge-check" class="icon icon--sm"></i> Vérifié</span>');
  if (logement.badge_etudiant) badges.push('<span class="badge badge-ink"><i data-lucide="graduation-cap" class="icon icon--sm"></i> Étudiant OK</span>');

  return `
    <div class="listing-card fade-in" onclick="goToListing('${logement.id}')" data-id="${logement.id}">
      <div class="listing-card-photo">
        ${photo
          ? `<img src="${photo}" alt="${logement.titre}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''
        }
        <div class="listing-card-placeholder" ${photo ? 'style="display:none"' : ''}>${logementIcon(logement.type)}</div>
        ${badges.length ? `<div class="listing-card-badges">${badges.join('')}</div>` : ''}
        <button class="listing-card-fav ${isFav ? 'active' : ''}"
          onclick="event.stopPropagation();favToggle('${logement.id}',this)"
          aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
          <i data-lucide="heart" class="icon" style="fill:${isFav ? 'currentColor' : 'none'};color:${isFav ? 'var(--color-red)' : 'inherit'}"></i>
        </button>
      </div>
      <div class="listing-card-body">
        <div class="listing-card-price">${formatFCFA(logement.loyer_mensuel)}<span style="font-size:0.75rem;font-weight:400;color:var(--ink-light)">/mois</span></div>
        <div class="listing-card-title">${logement.titre}</div>
        <div class="listing-card-location"><i data-lucide="map-pin" class="icon icon--sm"></i> ${logement.quartier}, ${logement.ville}</div>
      </div>
    </div>
  `;
}

// ================================================================
// Render carte featured (scroll horizontal)
// ================================================================
function renderFeaturedCard(logement) {
  const photo = logement.photos?.[0];
  return `
    <div onclick="goToListing('${logement.id}')" style="cursor:pointer;min-width:220px;background:var(--white);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-sm);flex-shrink:0">
      <div style="position:relative;aspect-ratio:4/3;background:var(--sand-dark)">
        ${photo
          ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${logementIcon(logement.type)}</div>`
        }
        <div style="position:absolute;bottom:8px;left:8px"><span class="badge badge-amber"><i data-lucide="sparkles" class="icon icon--sm"></i> À la une</span></div>
      </div>
      <div style="padding:10px">
        <div style="font-weight:700;color:var(--green);font-size:1rem">${formatFCFA(logement.loyer_mensuel)}<span style="font-size:0.75rem;font-weight:400;color:var(--ink-light)">/mois</span></div>
        <div style="font-size:0.875rem;color:var(--ink);margin-top:2px">${truncate(logement.titre, 30)}</div>
        <div style="font-size:0.75rem;color:var(--ink-light);margin-top:2px;display:flex;align-items:center;gap:3px"><i data-lucide="map-pin" class="icon icon--sm"></i> ${logement.quartier}</div>
      </div>
    </div>
  `;
}

// ================================================================
// Fetch listings avec filtres
// ================================================================
async function fetchListings(filters = {}, offset = 0) {
  let query = supabase
    .from('logements')
    .select('*, profiles!bailleur_id(nom, prenom, note_moyenne, photo_url)', { count: 'exact' })
    .eq('statut', 'libre')
    .order('boost_actif', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.loyer_max) query = query.lte('loyer_mensuel', filters.loyer_max);
  if (filters.meuble) query = query.eq('meuble', true);
  if (filters.verifie) query = query.eq('verifie', true);
  if (filters.badge_etudiant) query = query.eq('badge_etudiant', true);
  if (filters.search) query = query.or(`quartier.ilike.%${filters.search}%,titre.ilike.%${filters.search}%,ville.ilike.%${filters.search}%`);

  return query;
}

// ================================================================
// Charger stats
// ================================================================
async function loadStats() {
  try {
    const [{ count: nLog }, { count: nBailleurs }, { data: contacts }] = await Promise.all([
      supabase.from('logements').select('id', { count: 'exact', head: true }).neq('statut', 'archive'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['bailleur', 'agence']),
      supabase.from('logements').select('contacts').neq('statut', 'archive'),
    ]);

    const totalContacts = (contacts || []).reduce((s, l) => s + (l.contacts || 0), 0);

    const fmt = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n || 0);
    const s = document.getElementById('stat-logements');
    const b = document.getElementById('stat-bailleurs');
    const c = document.getElementById('stat-contacts');
    if (s) s.textContent = fmt(nLog);
    if (b) b.textContent = fmt(nBailleurs);
    if (c) c.textContent = fmt(totalContacts);
  } catch {}
}

// ================================================================
// Charger featured
// ================================================================
async function loadFeatured() {
  try {
    const { data } = await supabase
      .from('logements')
      .select('*')
      .eq('statut', 'libre')
      .eq('boost_actif', true)
      .limit(5);

    if (!data?.length) return;

    const section = document.getElementById('section-une');
    const list = document.getElementById('featured-list');
    if (!section || !list) return;

    section.style.display = 'block';
    list.innerHTML = data.map(renderFeaturedCard).join('');
    if (window.renderIcons) window.renderIcons();
  } catch {}
}

// ================================================================
// Charger listings principaux
// ================================================================
async function loadListings(append = false) {
  const grid = document.getElementById('listings-grid');
  const moreBtn = document.getElementById('load-more-container');
  if (!grid) return;

  if (!append) {
    grid.innerHTML = '<div class="card"><div class="skeleton" style="aspect-ratio:4/3"></div><div class="card-body"><div class="skeleton" style="height:20px;margin-bottom:8px"></div><div class="skeleton" style="height:14px;width:60%"></div></div></div>'.repeat(4);
  }

  try {
    const { data, count, error } = await fetchListings(currentFilters, currentOffset);
    if (error) throw error;

    if (!append) grid.innerHTML = '';

    if (!data?.length && !append) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:span 2">
        <div class="empty-icon"><i data-lucide="home" class="icon"></i></div>
        <h3>Aucun logement trouvé</h3>
        <p>Essayez d'autres filtres ou revenez plus tard.</p>
      </div>`;
      if (window.renderIcons) window.renderIcons();
      if (moreBtn) moreBtn.style.display = 'none';
      return;
    }

    grid.insertAdjacentHTML('beforeend', (data || []).map(l => renderListingCard(l)).join(''));
    if (window.renderIcons) window.renderIcons();
    currentOffset += data.length;

    if (moreBtn) {
      moreBtn.style.display = count > currentOffset ? 'block' : 'none';
    }
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:span 2">
      <div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div>
      <h3>Erreur de chargement</h3>
      <p>Vérifiez votre connexion et réessayez.</p>
    </div>`;
    if (window.renderIcons) window.renderIcons();
  }
}

// ================================================================
// Init — Home
// ================================================================
export async function init() {
  window.goToListing = (id) => {
    window.location.hash = `#listing-detail?id=${id}`;
  };

  window.favToggle = async (id, btn) => {
    try {
      const isFav = await toggleFavori(id);
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.style.fill = isFav ? 'currentColor' : 'none';
        svg.style.color = isFav ? 'var(--color-red)' : '';
      }
      btn.classList.toggle('active', isFav);
    } catch {}
  };

  // Vérifier onboarding
  if (!localStorage.getItem('locasyn_onboarded')) {
    window.location.hash = '#onboarding';
    return;
  }

  // Bouton "+ Publier" dans le header mobile : visible uniquement pour bailleur/agence
  getCurrentProfile().then(profile => {
    const btn = document.getElementById('home-btn-publier');
    if (btn && profile && (profile.role === 'bailleur' || profile.role === 'agence')) {
      btn.style.display = '';
    }
  });

  // Charger les données en parallèle
  await Promise.all([loadStats(), loadFeatured(), loadListings()]);

  // Restaurer scroll si on revient de la fiche
  restoreScrollPosition('home');

  // Filtres pills
  const filterPills = document.getElementById('filter-pills');
  if (filterPills) {
    filterPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (!pill) return;

      filterPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      currentFilters = {};
      currentOffset = 0;

      if (pill.dataset.filter) currentFilters.type = pill.dataset.filter;
      if (pill.dataset.meuble) currentFilters.meuble = true;
      if (pill.dataset.verifie) currentFilters.verifie = true;
      if (pill.dataset.etudiant) currentFilters.badge_etudiant = true;

      if (!pill.dataset.filter && !pill.dataset.meuble && !pill.dataset.verifie && !pill.dataset.etudiant) {
        currentFilters = {};
      }

      loadListings(false);
    });
  }

  // Load more
  const btnMore = document.getElementById('btn-load-more');
  if (btnMore) {
    btnMore.addEventListener('click', () => loadListings(true));
  }

  // Unread messages badge
  loadUnreadCount();
}

async function loadUnreadCount() {
  const user = await getCurrentUser();
  if (!user) return;

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('lu', false)
    .neq('expediteur_id', user.id);

  const badge = document.getElementById('msg-badge');
  if (badge && count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  }
}

// ================================================================
// Init — Favoris
// ================================================================
export async function initFavoris() {
  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  const container = document.getElementById('favoris-grid');
  if (!container) return;

  container.innerHTML = '<div style="display:flex;justify-content:center;padding:40px"><div class="spinner spinner-lg"></div></div>';

  try {
    const { data, error } = await supabase
      .from('favoris')
      .select('logement_id, logements(*, profiles!bailleur_id(nom, prenom, note_moyenne, photo_url))')
      .eq('utilisateur_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FAVORIS] Erreur chargement:', error.message, error);
      throw error;
    }

    const valides = (data || []).filter(f => f.logements && f.logements.statut !== 'archive');

    if (!valides.length) {
      container.innerHTML = `<div class="empty-state" style="grid-column:span 2">
        <div class="empty-icon"><i data-lucide="heart" class="icon"></i></div>
        <h3>Aucun favori</h3>
        <p>Explorez les logements et sauvegardez vos préférés !</p>
        <button class="btn btn-primary" onclick="window.location.hash='#home'">Explorer</button>
      </div>`;
      if (window.renderIcons) window.renderIcons();
      return;
    }

    window.goToListing = (id) => { window.location.hash = `#listing-detail?id=${id}`; };
    window.favToggle = async (id, btn) => {
      await toggleFavori(id);
      const card = btn.closest('.listing-card');
      card?.remove();
      if (!container.querySelector('.listing-card')) {
        container.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon"><i data-lucide="heart" class="icon"></i></div><h3>Aucun favori</h3><p>Tous vos favoris ont été retirés.</p></div>`;
        if (window.renderIcons) window.renderIcons();
      }
    };

    container.innerHTML = valides.map(f => renderListingCard(f.logements)).join('');
    if (window.renderIcons) window.renderIcons();
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div><h3>Erreur</h3><p>${err.message}</p></div>`;
    if (window.renderIcons) window.renderIcons();
  }
}

// ================================================================
// Init — Recherche avancée
// ================================================================
export async function initSearch(params = {}) {
  const filters = { ...params };
  let map = null;
  let markers = [];

  window.goToListing = (id) => { window.location.hash = `#listing-detail?id=${id}`; };
  window.favToggle = async (id, btn) => {
    const isFav = await toggleFavori(id);
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.style.fill = isFav ? 'currentColor' : 'none';
      svg.style.color = isFav ? 'var(--color-red)' : '';
    }
    btn.classList.toggle('active', isFav);
  };

  const searchInput = document.getElementById('search-input');
  const resultsGrid = document.getElementById('search-results');
  const mapView = document.getElementById('map-view');

  // Init carte Leaflet
  if (mapView && window.L) {
    map = L.map('map-leaflet').setView([6.3702, 2.3912], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  }

  const performSearch = debounce(async () => {
    if (!resultsGrid) return;
    resultsGrid.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;grid-column:span 2"><div class="spinner spinner-lg"></div></div>';

    // Récupérer filtres depuis les inputs
    const searchTerm = searchInput?.value?.trim() || '';
    const typeEl = document.getElementById('filter-type');
    const budgetEl = document.getElementById('filter-budget');
    const meubleEl = document.getElementById('filter-meuble');
    const verifieEl = document.getElementById('filter-verifie');
    const etudiantEl = document.getElementById('filter-etudiant');

    const searchFilters = {};
    if (searchTerm) searchFilters.search = searchTerm;
    if (typeEl?.value) searchFilters.type = typeEl.value;
    if (budgetEl?.value) searchFilters.loyer_max = parseInt(budgetEl.value);
    if (meubleEl?.checked) searchFilters.meuble = true;
    if (verifieEl?.checked) searchFilters.verifie = true;
    if (etudiantEl?.checked) searchFilters.badge_etudiant = true;

    try {
      let query = supabase
        .from('logements')
        .select('*, profiles!bailleur_id(nom, prenom, note_moyenne)')
        .eq('statut', 'libre')
        .order('boost_actif', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);

      if (searchFilters.search) query = query.or(`quartier.ilike.%${searchFilters.search}%,titre.ilike.%${searchFilters.search}%,ville.ilike.%${searchFilters.search}%`);
      if (searchFilters.type) query = query.eq('type', searchFilters.type);
      if (searchFilters.loyer_max) query = query.lte('loyer_mensuel', searchFilters.loyer_max);
      if (searchFilters.meuble) query = query.eq('meuble', true);
      if (searchFilters.verifie) query = query.eq('verifie', true);
      if (searchFilters.badge_etudiant) query = query.eq('badge_etudiant', true);

      const { data, error } = await query;
      if (error) throw error;

      // Résultats texte
      if (!data?.length) {
        resultsGrid.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon"><i data-lucide="search" class="icon"></i></div><h3>Aucun résultat</h3><p>Essayez d'autres critères de recherche.</p></div>`;
      } else {
        resultsGrid.innerHTML = data.map(l => renderListingCard(l)).join('');
      }
      if (window.renderIcons) window.renderIcons();

      // Mise à jour carte
      if (map) {
        markers.forEach(m => m.remove());
        markers = [];
        (data || []).filter(l => l.latitude && l.longitude).forEach(l => {
          const icon = L.divIcon({
            className: '',
            html: `<div class="map-marker">${formatFCFA(l.loyer_mensuel).replace(' FCFA', '')}</div>`,
            iconAnchor: [30, 20],
          });
          const m = L.marker([l.latitude, l.longitude], { icon })
            .addTo(map)
            .on('click', () => { window.location.hash = `#listing-detail?id=${l.id}`; });
          markers.push(m);
        });
      }

    } catch (err) {
      resultsGrid.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="empty-icon"><i data-lucide="alert-triangle" class="icon"></i></div><h3>Erreur</h3><p>${err.message}</p></div>`;
      if (window.renderIcons) window.renderIcons();
    }
  }, 400);

  // Listeners
  searchInput?.addEventListener('input', performSearch);
  document.getElementById('filter-type')?.addEventListener('change', performSearch);
  document.getElementById('filter-budget')?.addEventListener('change', performSearch);
  document.getElementById('filter-meuble')?.addEventListener('change', performSearch);
  document.getElementById('filter-verifie')?.addEventListener('change', performSearch);
  document.getElementById('filter-etudiant')?.addEventListener('change', performSearch);

  // Vue liste / carte
  document.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isMap = btn.dataset.view === 'map';
      if (resultsGrid) resultsGrid.style.display = isMap ? 'none' : 'grid';
      if (mapView) mapView.classList.toggle('active', isMap);
      if (isMap && map) setTimeout(() => map.invalidateSize(), 100);
    });
  });

  // Pré-remplir depuis params URL
  if (params.q && searchInput) searchInput.value = params.q;

  performSearch();
}
