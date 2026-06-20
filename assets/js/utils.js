// ================================================================
// LocaSyn — utils.js
// Fonctions utilitaires globales
// ================================================================

// ----------------------------------------------------------------
// Formatage FCFA — JAMAIS afficher un montant brut
// ----------------------------------------------------------------
export const formatFCFA = (n) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' FCFA';

export const formatFCFACompact = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)} M FCFA`;
  if (n >= 1000) return `${Math.round(n / 1000)} k FCFA`;
  return formatFCFA(n);
};

// ----------------------------------------------------------------
// Dates
// ----------------------------------------------------------------
export function dateRelative(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
  if (diff < 172800000) return 'Hier';
  if (diff < 604800000) return `Il y a ${Math.floor(diff / 86400000)} jours`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '';
  const defaults = { day: 'numeric', month: 'long', year: 'numeric' };
  return new Date(dateStr).toLocaleDateString('fr-FR', { ...defaults, ...opts });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function moisLabel(moisStr) {
  if (!moisStr) return '';
  const [year, month] = moisStr.split('-');
  const noms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${noms[parseInt(month) - 1]} ${year}`;
}

export function moisActuel() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ----------------------------------------------------------------
// Avatar initiales
// ----------------------------------------------------------------
export const initiales = (nom, prenom) =>
  `${(prenom || '')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase() || '?';

// ----------------------------------------------------------------
// Toast notification
// ----------------------------------------------------------------
function getOrCreateToast() {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  return t;
}

let toastTimer;
export function showToast(message, type = 'info', duration = 3000) {
  const toast = getOrCreateToast();
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast toast-${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ----------------------------------------------------------------
// Truncate texte
// ----------------------------------------------------------------
export const truncate = (str, n) =>
  str && str.length > n ? str.slice(0, n) + '...' : (str || '');

// ----------------------------------------------------------------
// Score complétude logement
// ----------------------------------------------------------------
export function scoreCompletude(logement) {
  let score = 0;
  if (logement.titre) score += 10;
  if (logement.description?.length > 100) score += 15;
  if (logement.photos?.length >= 3) score += 25;
  if (logement.photos?.length >= 6) score += 10;
  if (logement.video_url) score += 15;
  if (logement.latitude) score += 10;
  if (logement.equipements?.length >= 3) score += 10;
  if (logement.surface_m2) score += 5;
  return score;
}

// ----------------------------------------------------------------
// Masquage numéros de téléphone
// ----------------------------------------------------------------
export function sanitizeMessage(text) {
  if (!text) return text;
  return text
    .replace(/(\+229|00229)?\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}/g, '📵 [N° masqué]')
    .replace(/\b(97|96|95|94|93|92|91|90|67|66|65|64|63|62|61|60|51)\d{6}\b/g, '📵 [N° masqué]');
}

// ----------------------------------------------------------------
// Validation téléphone béninois
// ----------------------------------------------------------------
export function validateTelBenin(tel) {
  const cleaned = tel.replace(/[\s\-\.]/g, '');
  return /^(\+229|00229)?[0-9]{8}$/.test(cleaned);
}

// ----------------------------------------------------------------
// Icône Lucide selon type de logement
// ----------------------------------------------------------------
const LOGEMENT_ICON_MAP = {
  chambre: 'bed-single',
  studio: 'home',
  f2: 'building-2',
  f3: 'building',
  f4plus: 'building',
  villa: 'landmark',
  local: 'store',
};

// Helper → retourne le HTML <i data-lucide="...">
export function logementIcon(type, sizeClass = 'icon--xl') {
  const name = LOGEMENT_ICON_MAP[type] || 'home';
  return `<i data-lucide="${name}" class="icon ${sizeClass}"></i>`;
}

// Alias backward-compat (non utilisé pour le rendu — voir logementIcon)
export const LOGEMENT_EMOJI = LOGEMENT_ICON_MAP;

export const LOGEMENT_LABEL = {
  chambre: 'Chambre',
  studio: 'Studio',
  f2: 'F2',
  f3: 'F3',
  f4plus: 'F4+',
  villa: 'Villa',
  local: 'Local commercial',
};

// ----------------------------------------------------------------
// Offline detection
// ----------------------------------------------------------------
export function initOfflineBanner() {
  let banner = document.querySelector('.offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'offline-banner';
    banner.innerHTML = '<i data-lucide="wifi-off" class="icon icon--sm"></i> Connexion perdue — certaines fonctionnalités indisponibles';
    document.body.prepend(banner);
    if (window.renderIcons) window.renderIcons();
  }

  const update = () => {
    if (!navigator.onLine) {
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
  };

  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ----------------------------------------------------------------
// Étoiles rating (Lucide stars)
// ----------------------------------------------------------------
export function renderStars(note, max = 5) {
  const full = Math.round(note);
  let html = '<div class="stars">';
  for (let i = 1; i <= max; i++) {
    html += `<i data-lucide="star" class="icon icon--sm" style="fill:${i <= full ? 'var(--color-gold)' : 'none'};color:var(--color-gold)"></i>`;
  }
  html += '</div>';
  return html;
}

// ----------------------------------------------------------------
// Debounce
// ----------------------------------------------------------------
export function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ----------------------------------------------------------------
// Générer initiales colorées avec fond
// ----------------------------------------------------------------
const AVATAR_COLORS = ['#1B6B4A', '#C4831A', '#2D8A60', '#8A4A1A', '#1A4A6B'];
export function avatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let c of str) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ----------------------------------------------------------------
// Quartiers Bénin (autocomplete)
// ----------------------------------------------------------------
export const QUARTIERS_COTONOU = [
  'Akpakpa', 'Agla', 'Gbégamey', 'Cadjehoun', 'Fidjrossè', 'Kouhounou',
  'Dantokpa', 'Tokpa', 'Ganhi', 'Sikècodji', 'Vedoko', 'Ladji', 'Houéyiho',
  'Mènontin', 'Zogbo', 'Sainte-Rita', 'Kpota', 'Sèmè', 'Cotonou-Centre'
];

export const QUARTIERS_CALAVI = [
  'Godomey', 'Agla', 'Cococodji', 'Togba', 'Abomey-Calavi Centre', 'Hêvié',
  'Kpanroun', 'Gbèdjromèdji', 'Zinvié', 'Ouèdo', 'UAC Campus', 'Glo-Djigbé',
  'Tankpè', 'Sô-Ava'
];

export const QUARTIERS_PORTO_NOVO = [
  'Adjarra', 'Avrankou', 'Akron', 'Oganla', 'Centre', 'Aïdjèdo', 'Gbèko'
];

export const QUARTIERS_PARAKOU = [
  'Banikanni', 'Madina', 'Titirou', 'Zongo', 'Tourou', 'Ladji Kotoli'
];

export function getQuartiersByVille(ville) {
  const map = {
    'Cotonou': QUARTIERS_COTONOU,
    'Abomey-Calavi': QUARTIERS_CALAVI,
    'Porto-Novo': QUARTIERS_PORTO_NOVO,
    'Parakou': QUARTIERS_PARAKOU,
  };
  return map[ville] || [];
}

// ----------------------------------------------------------------
// Spinner helper
// ----------------------------------------------------------------
export function showLoading(container) {
  container.innerHTML = `<div style="display:flex;justify-content:center;padding:40px"><div class="spinner spinner-lg"></div></div>`;
}

// ----------------------------------------------------------------
// Scroll position saver (pour marketplace)
// ----------------------------------------------------------------
export function saveScrollPosition(key) {
  sessionStorage.setItem(`scroll_${key}`, window.scrollY);
}

export function restoreScrollPosition(key) {
  const pos = sessionStorage.getItem(`scroll_${key}`);
  if (pos) {
    requestAnimationFrame(() => window.scrollTo(0, parseInt(pos)));
    sessionStorage.removeItem(`scroll_${key}`);
  }
}
