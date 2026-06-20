// ================================================================
// LocaSyn — router.js
// SPA routing hash-based
// ================================================================

import { getCurrentUser, getCurrentProfile } from './auth.js';
import { saveScrollPosition, showToast } from './utils.js';
import { renderIcons } from './icons.js';

const routes = {
  '':                 'screens/home.html',
  'home':             'screens/home.html',
  'search':           'screens/search.html',
  'listing-detail':   'screens/listing-detail.html',
  'messages':         'screens/messages.html',
  'chat':             'screens/chat.html',
  'publish':          'screens/publish.html',
  'payment-caution':  'screens/payment-caution.html',
  'payment-loyer':    'screens/payment-loyer.html',
  'profile':          'screens/profile.html',
  'mes-annonces':     'screens/mes-annonces.html',
  'loyers':           'screens/loyers.html',
  'contrats':         'screens/contrats.html',
  'favoris':          'screens/favoris.html',
  'boost':            'screens/boost.html',
  'solde':            'screens/solde.html',
  'admin':            'screens/admin.html',
  'auth':             'screens/auth.html',
  'onboarding':       'screens/onboarding.html',
};

const protectedRoutes = new Set([
  'publish', 'payment-caution', 'payment-loyer',
  'profile', 'mes-annonces', 'loyers', 'contrats',
  'boost', 'solde', 'admin', 'chat', 'messages', 'favoris',
]);

// Routes réservées à certains rôles (Couche 2 — défense en profondeur)
const routesParRole = {
  'publish':      ['bailleur', 'agence'],
  'mes-annonces': ['bailleur', 'agence'],
  'loyers':       ['bailleur', 'agence'],
  'boost':        ['bailleur', 'agence'],
  'solde':        ['bailleur', 'agence'],
};

// Modules associés aux routes
const moduleMap = {
  'home':           () => import('./modules/marketplace.js'),
  '':               () => import('./modules/marketplace.js'),
  'search':         () => import('./modules/marketplace.js'),
  'listing-detail': () => import('./modules/listing.js'),
  'messages':       () => import('./modules/messaging.js'),
  'chat':           () => import('./modules/messaging.js'),
  'publish':        () => import('./modules/publish.js'),
  'payment-caution':() => import('./modules/payment.js'),
  'payment-loyer':  () => import('./modules/payment.js'),
  'profile':        () => import('./modules/profile.js'),
  'mes-annonces':   () => import('./modules/profile.js'),
  'loyers':         () => import('./modules/loyers.js'),
  'contrats':       () => import('./modules/profile.js'),
  'favoris':        () => import('./modules/marketplace.js'),
  'boost':          () => import('./modules/profile.js'),
  'solde':          () => import('./modules/solde.js'),
  'admin':          () => import('./modules/admin.js'),
};

// Cleanup à chaque navigation (Realtime subscriptions, etc.)
let currentCleanup = null;

// Re-exécute les scripts injectés via innerHTML (ils ne s'exécutent pas nativement).
// Tous les screens sans moduleMap utilisent des <script> ordinaires (pas type="module").
function executeInlineScripts(container) {
  for (const script of container.querySelectorAll('script')) {
    if (script.src) continue;
    const newScript = document.createElement('script');
    newScript.textContent = script.textContent;
    document.body.appendChild(newScript);
  }
}

export async function navigate(hash) {
  const raw = hash.replace('#', '') || '';
  const [route, queryString] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(queryString || ''));

  // Sauvegarder scroll si on quitte la home
  const prevRoute = window.__currentRoute;
  if (prevRoute === 'home' || prevRoute === '') {
    saveScrollPosition('home');
  }

  // Cleanup module précédent
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch {}
    currentCleanup = null;
  }

  // Vérification auth sur routes protégées
  const user = await getCurrentUser();
  if (protectedRoutes.has(route) && !user) {
    sessionStorage.setItem('locasyn_redirect', hash);
    window.location.hash = '#auth';
    return;
  }

  // Vérification rôle (Couche 2 — défense en profondeur)
  if (user && routesParRole[route]) {
    const profile = await getCurrentProfile();
    if (!profile || !routesParRole[route].includes(profile.role)) {
      showToast('Accès réservé aux bailleurs et agences', 'error');
      window.location.hash = '#home';
      return;
    }
  }

  // Vérification admin
  if (route === 'admin') {
    const profile = await getCurrentProfile();
    if (!profile || profile.role !== 'admin') {
      window.location.hash = '#home';
      return;
    }
  }

  const screenPath = routes[route] || routes['home'];
  window.__routeParams = params;
  window.__currentRoute = route;

  // Charger l'écran HTML
  const app = document.getElementById('app');
  if (!app) return;

  try {
    const resp = await fetch(screenPath);
    if (!resp.ok) throw new Error(`Screen not found: ${screenPath}`);
    const html = await resp.text();
    app.innerHTML = html;
    // Les <script> injectés via innerHTML ne s'exécutent pas (sécurité navigateur).
    // Pour les routes sans moduleMap (onboarding, auth), on les rejoue manuellement.
    if (!moduleMap[route]) {
      executeInlineScripts(app);
    }
  } catch (err) {
    app.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><i data-lucide="frown" class="icon"></i></div>
      <h3>Écran introuvable</h3>
      <p>${err.message}</p>
    </div>`;
  }

  // Init module
  const importFn = moduleMap[route];
  if (importFn) {
    try {
      const mod = await importFn();
      const initFn = route === 'search' ? mod.initSearch
        : route === 'favoris' ? mod.initFavoris
        : route === 'chat' ? mod.initChat
        : route === 'messages' ? mod.initMessages
        : route === 'payment-caution' ? mod.initPaymentCaution
        : route === 'payment-loyer' ? mod.initPaymentLoyer
        : route === 'mes-annonces' ? mod.initMesAnnonces
        : route === 'contrats' ? mod.initContrats
        : route === 'boost' ? mod.initBoost
        : mod.init;

      if (typeof initFn === 'function') {
        currentCleanup = await initFn(params) || null;
      }
    } catch (err) {
      console.error(`Module init error (${route}):`, err);
    }
  }

  window.scrollTo(0, 0);
  updateBottomNav(route);
  renderIcons();
}


export function updateBottomNav(route) {
  const items = document.querySelectorAll('.bottom-nav-item');
  items.forEach(item => {
    const href = item.dataset.route || '';
    item.classList.toggle('active', href === route || (href === 'home' && (route === '' || route === 'home')));
  });
}

export function initRouter() {
  window.addEventListener('hashchange', () => navigate(window.location.hash));
  navigate(window.location.hash);
}
