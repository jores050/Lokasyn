// ================================================================
// LocaSyn — sidebar.js
// Sidebar de navigation desktop (≥ 1024px)
// Injectée une seule fois dans le DOM, indépendante du router.
// ================================================================

import store from '../store.js';

// Nav items sans "Publier" (conditionnel selon le rôle)
const NAV_ITEMS = [
  { route: 'home',     icon: svgHome(),    label: 'Accueil' },
  { route: 'search',   icon: svgSearch(),  label: 'Recherche' },
  { route: 'messages', icon: svgChat(),    label: 'Messages', badge: true },
  { route: 'profile',  icon: svgUser(),    label: 'Mon profil' },
];

// ----------------------------------------------------------------
// Icônes SVG inline (stroke, pas de dépendance externe)
// ----------------------------------------------------------------
function svgHome() {
  return `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
}
function svgSearch() {
  return `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
}
function svgPlus() {
  return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
}
function svgChat() {
  return `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
}
function svgUser() {
  return `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
}
function svgFavoris() {
  return `<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
}

// ----------------------------------------------------------------
// Créer et injecter la sidebar
// ----------------------------------------------------------------
export function initSidebar() {
  if (document.getElementById('sidebar-nav')) return;

  const sidebar = document.createElement('nav');
  sidebar.id = 'sidebar-nav';
  sidebar.className = 'sidebar-nav';
  sidebar.innerHTML = `
    <div class="sidebar-logo">Loka<span>syn</span></div>

    <!-- Zone publish : visible uniquement pour bailleur/agence — remplie après chargement du profil -->
    <div id="sidebar-publish-area"></div>

    <div class="sidebar-nav-items">
      ${NAV_ITEMS.map(item => `
        <a class="sidebar-nav-item" data-route="${item.route}" href="#${item.route}">
          <span class="sidebar-nav-icon">${item.icon}</span>
          <span class="sidebar-nav-label">${item.label}</span>
          ${item.badge ? `<span class="sidebar-nav-badge" id="sidebar-msg-badge" style="display:none">0</span>` : ''}
        </a>
      `).join('')}
    </div>

    <div class="sidebar-bottom">
      <a class="sidebar-nav-item" data-route="favoris" href="#favoris">
        <span class="sidebar-nav-icon">${svgFavoris()}</span>
        <span class="sidebar-nav-label">Favoris</span>
      </a>
    </div>
  `;

  const wrapper = document.getElementById('app-wrapper');
  document.body.insertBefore(sidebar, wrapper);

  syncActive();
  window.addEventListener('hashchange', syncActive);

  // Réagit aux changements de profil (connexion, déconnexion, changement de compte)
  store.subscribe('profile', (profile) => {
    _refreshPublishArea(profile);
  });

  // Appliquer le profil déjà en cache si disponible au moment de l'init
  _refreshPublishArea(store.get('profile'));
}

// ----------------------------------------------------------------
// Injecte ou retire les éléments "Publier" selon le rôle
// ----------------------------------------------------------------
function _refreshPublishArea(profile) {
  const area = document.getElementById('sidebar-publish-area');
  if (!area) return;

  const peutPublier = profile && (profile.role === 'bailleur' || profile.role === 'agence');

  if (peutPublier) {
    area.innerHTML = `
      <button class="sidebar-publish-btn" onclick="window.location.hash='#publish'">
        + Publier une annonce
      </button>
    `;
    // Ajouter le nav item "Publier" s'il n'existe pas encore
    if (!document.querySelector('.sidebar-nav-item[data-route="publish"]')) {
      const navItems = document.querySelector('.sidebar-nav-items');
      if (navItems) {
        const publishItem = document.createElement('a');
        publishItem.className = 'sidebar-nav-item';
        publishItem.dataset.route = 'publish';
        publishItem.href = '#publish';
        publishItem.innerHTML = `
          <span class="sidebar-nav-icon">${svgPlus()}</span>
          <span class="sidebar-nav-label">Publier</span>
        `;
        // Insérer après Recherche (2ème item)
        const items = navItems.querySelectorAll('.sidebar-nav-item');
        if (items[1]) {
          items[1].insertAdjacentElement('afterend', publishItem);
        } else {
          navItems.appendChild(publishItem);
        }
      }
    }
  } else {
    area.innerHTML = '';
    // Retirer le nav item "Publier" s'il est présent
    const publishNavItem = document.querySelector('.sidebar-nav-item[data-route="publish"]');
    if (publishNavItem) publishNavItem.remove();
  }

  syncActive();
}

function syncActive() {
  const route = (window.location.hash.replace('#', '') || 'home').split('?')[0];
  document.querySelectorAll('.sidebar-nav-item').forEach(item => {
    const r = item.dataset.route;
    item.classList.toggle('active', r === route || (r === 'home' && (route === '' || route === 'home')));
  });
}

// ----------------------------------------------------------------
// Mettre à jour le badge messages dans la sidebar
// ----------------------------------------------------------------
export function updateSidebarBadge(count) {
  const badge = document.getElementById('sidebar-msg-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}
