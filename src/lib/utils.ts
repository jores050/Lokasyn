// ----------------------------------------------------------------
// Formatage monétaire
// ----------------------------------------------------------------
export const formatFCFA = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' FCFA'

export const formatFCFACompact = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M FCFA`
  if (n >= 1_000) return `${Math.round(n / 1_000)} k FCFA`
  return formatFCFA(n)
}

// ----------------------------------------------------------------
// Dates
// ----------------------------------------------------------------
export function dateRelative(dateStr: string): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60_000) return "À l'instant"
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)}h`
  if (diff < 172_800_000) return 'Hier'
  if (diff < 604_800_000) return `Il y a ${Math.floor(diff / 86_400_000)} jours`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function formatDate(dateStr: string, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!dateStr) return ''
  const defaults: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  return new Date(dateStr).toLocaleDateString('fr-FR', { ...defaults, ...opts })
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function moisLabel(moisStr: string): string {
  if (!moisStr) return ''
  const [year, month] = moisStr.split('-')
  const noms = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  return `${noms[parseInt(month) - 1]} ${year}`
}

export function moisActuel(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ----------------------------------------------------------------
// Avatar
// ----------------------------------------------------------------
export const initiales = (nom: string, prenom: string): string =>
  `${(prenom || '')[0] || ''}${(nom || '')[0] || ''}`.toUpperCase() || '?'

const AVATAR_COLORS = ['#1B6B4A', '#C4831A', '#2D8A60', '#8A4A1A', '#1A4A6B']
export function avatarColor(str: string): string {
  if (!str) return AVATAR_COLORS[0]
  let hash = 0
  for (const c of str) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ----------------------------------------------------------------
// Texte
// ----------------------------------------------------------------
export const truncate = (str: string, n: number): string =>
  str && str.length > n ? str.slice(0, n) + '...' : (str || '')

export function sanitizeMessage(text: string): string {
  if (!text) return text
  return text
    .replace(/(\+229|00229)?\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}\s*[0-9]{2}/g, '📵 [N° masqué]')
    .replace(/\b(97|96|95|94|93|92|91|90|67|66|65|64|63|62|61|60|51)\d{6}\b/g, '📵 [N° masqué]')
}

export function validateTelBenin(tel: string): boolean {
  const cleaned = tel.replace(/[\s\-.]/g, '')
  return /^(\+229|00229)?[0-9]{8}$/.test(cleaned)
}

// ----------------------------------------------------------------
// Score complétude logement
// ----------------------------------------------------------------
export function scoreCompletude(logement: Record<string, unknown>): number {
  let score = 0
  if (logement.titre) score += 10
  if ((logement.description as string)?.length > 100) score += 15
  if ((logement.photos as unknown[])?.length >= 3) score += 25
  if ((logement.photos as unknown[])?.length >= 6) score += 10
  if (logement.video_url) score += 15
  if (logement.latitude) score += 10
  if ((logement.equipements as unknown[])?.length >= 3) score += 10
  if (logement.surface_m2) score += 5
  return score
}

// ----------------------------------------------------------------
// Quartiers Bénin
// ----------------------------------------------------------------
export const QUARTIERS_COTONOU = [
  'Akpakpa', 'Agla', 'Gbégamey', 'Cadjehoun', 'Fidjrossè', 'Kouhounou',
  'Dantokpa', 'Tokpa', 'Ganhi', 'Sikècodji', 'Vedoko', 'Ladji', 'Houéyiho',
  'Mènontin', 'Zogbo', 'Sainte-Rita', 'Kpota', 'Sèmè', 'Cotonou-Centre',
]

export const QUARTIERS_CALAVI = [
  'Godomey', 'Agla', 'Cococodji', 'Togba', 'Abomey-Calavi Centre', 'Hêvié',
  'Kpanroun', 'Gbèdjromèdji', 'Zinvié', 'Ouèdo', 'UAC Campus', 'Glo-Djigbé',
  'Tankpè', 'Sô-Ava',
]

export const QUARTIERS_PORTO_NOVO = ['Adjarra', 'Avrankou', 'Akron', 'Oganla', 'Centre', 'Aïdjèdo', 'Gbèko']
export const QUARTIERS_PARAKOU = ['Banikanni', 'Madina', 'Titirou', 'Zongo', 'Tourou', 'Ladji Kotoli']

export function getQuartiersByVille(ville: string): string[] {
  const map: Record<string, string[]> = {
    'Cotonou': QUARTIERS_COTONOU,
    'Abomey-Calavi': QUARTIERS_CALAVI,
    'Porto-Novo': QUARTIERS_PORTO_NOVO,
    'Parakou': QUARTIERS_PARAKOU,
  }
  return map[ville] || []
}

// ----------------------------------------------------------------
// Types logement
// ----------------------------------------------------------------
export const LOGEMENT_LABEL: Record<string, string> = {
  chambre: 'Chambre', studio: 'Studio', f2: 'F2',
  f3: 'F3', f4plus: 'F4+', villa: 'Villa', local: 'Local commercial',
}

// ----------------------------------------------------------------
// Debounce
// ----------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(fn: T, delay = 300) {
  let t: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}
