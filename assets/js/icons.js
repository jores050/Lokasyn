// assets/js/icons.js
// Centralise l'init Lucide — appelé après CHAQUE rendu d'écran ou de composant dynamique,
// car Lucide doit scanner le DOM pour transformer les <i data-lucide="..."> en SVG.
export function renderIcons() {
  if (typeof lucide === 'undefined') {
    console.warn('[ICONS] Lucide non chargé — vérifier le script CDN dans index.html');
    return;
  }
  lucide.createIcons({ attrs: { 'stroke-width': 1.75 } });
}

// Exposé globalement pour les modules chargés en lazy-import
window.renderIcons = renderIcons;
