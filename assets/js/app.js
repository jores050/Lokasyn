// ================================================================
// LocaSyn — app.js
// Point d'entrée principal
// ================================================================

import { initAuth } from './auth.js';
import { initRouter, navigate } from './router.js';
import { initOfflineBanner } from './utils.js';
import { initSidebar } from './components/sidebar.js';

// ----------------------------------------------------------------
// Détection breakpoint
// ----------------------------------------------------------------
function getBreakpoint() {
  const w = window.innerWidth;
  if (w >= 1024) return 'desktop';
  if (w >= 768) return 'tablet';
  return 'mobile';
}

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ----------------------------------------------------------------
// Boot
// ----------------------------------------------------------------
async function boot() {
  // Offline detection
  initOfflineBanner();

  // Sidebar desktop (injectée une fois, cachée sur mobile via CSS)
  initSidebar();

  // Auth (session, listener)
  await initAuth();

  // Router (charge l'écran selon le hash)
  initRouter();

  // Resize : re-render l'écran actif si le breakpoint change
  // (important pour messagerie/search qui changent de DOM entre mobile et desktop)
  let currentBreakpoint = getBreakpoint();
  window.addEventListener('resize', debounce(() => {
    const newBp = getBreakpoint();
    if (newBp !== currentBreakpoint) {
      currentBreakpoint = newBp;
      navigate(window.location.hash);
    }
  }, 250));
}

// Attendre que le DOM soit prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
