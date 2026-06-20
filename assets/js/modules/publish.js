// ================================================================
// LocaSyn — publish.js
// Publication d'annonce — stepper 5 étapes
// ================================================================

import supabase from '../supabase.js';
import { formatFCFA, getQuartiersByVille, LOGEMENT_LABEL, logementIcon, showToast } from '../utils.js';
import { getCurrentUser } from '../auth.js';

const state = {
  type: null,
  ville: 'Cotonou',
  quartier: '',
  adresse: '',
  lat: null,
  lng: null,
  loyer: null,
  caution: 2,
  bail: 'mensuel',
  surface: null,
  meuble: false,
  eau: false,
  elec: false,
  etudiant: false,
  equipements: [],
  photos: [],
  photoFiles: [],
  description: '',
  boost: false,
};

let publishMap = null;
let publishMarker = null;
let currentStep = 1;

// ================================================================
// Navigation steps
// ================================================================
window.goStep = function(n) {
  if (n > currentStep && !validateStep(currentStep)) return;

  document.querySelectorAll('.publish-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');

  // Stepper dots
  for (let i = 1; i <= 5; i++) {
    const dot = document.getElementById(`dot-${i}`);
    const line = document.getElementById(`line-${i}`);
    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (i < n) { dot.classList.add('done'); dot.innerHTML = '<i data-lucide="check" class="icon icon--sm"></i>'; if (window.renderIcons) window.renderIcons(); }
    else if (i === n) { dot.classList.add('active'); dot.textContent = i; }
    else { dot.textContent = i; }
    if (line) line.classList.toggle('done', i < n);
  }

  if (n === 5) renderRecap();
  currentStep = n;
  window.scrollTo(0, 0);
};

// ================================================================
// Validation par étape
// ================================================================
function validateStep(n) {
  if (n === 1) {
    if (!state.type) {
      const err = document.getElementById('err-type');
      if (err) { err.style.display = 'block'; }
      return false;
    }
  }
  if (n === 2) {
    const quartier = document.getElementById('pub-quartier')?.value?.trim();
    if (!quartier) {
      const err = document.getElementById('err-quartier');
      if (err) { err.textContent = 'Le quartier est requis'; err.classList.add('show'); }
      return false;
    }
    state.quartier = quartier;
    state.ville = document.getElementById('pub-ville')?.value || 'Cotonou';
    state.adresse = document.getElementById('pub-adresse')?.value?.trim() || '';
    state.lat = parseFloat(document.getElementById('pub-lat')?.value) || null;
    state.lng = parseFloat(document.getElementById('pub-lng')?.value) || null;
  }
  if (n === 3) {
    const loyer = parseInt(document.getElementById('pub-loyer')?.value);
    if (!loyer || loyer < 5000) {
      const err = document.getElementById('err-loyer');
      if (err) { err.textContent = 'Loyer minimum : 5 000 FCFA'; err.classList.add('show'); }
      return false;
    }
    state.loyer = loyer;
    state.caution = parseInt(document.getElementById('pub-caution')?.value) || 2;
    state.bail = document.getElementById('pub-bail')?.value || 'mensuel';
    state.surface = parseInt(document.getElementById('pub-surface')?.value) || null;
    state.meuble = document.getElementById('pub-meuble')?.checked || false;
    state.eau = document.getElementById('pub-eau')?.checked || false;
    state.elec = document.getElementById('pub-elec')?.checked || false;
    state.etudiant = document.getElementById('pub-etudiant')?.checked || false;
    state.equipements = [...document.querySelectorAll('.equipement-item.selected')].map(el => el.dataset.eq);
  }
  if (n === 4) {
    if (state.photos.length < 3) {
      const err = document.getElementById('err-photos');
      if (err) { err.textContent = 'Minimum 3 photos requises'; err.classList.add('show'); }
      return false;
    }
    state.description = document.getElementById('pub-desc')?.value?.trim() || '';
  }
  return true;
}

// ================================================================
// Sélection type
// ================================================================
window.selectType = function(el) {
  document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  state.type = el.dataset.type;
  const err = document.getElementById('err-type');
  if (err) err.style.display = 'none';
};

// ================================================================
// Quartiers autocomplete
// ================================================================
window.updateQuartiers = function() {
  const ville = document.getElementById('pub-ville')?.value;
  const dl = document.getElementById('quartiers-list');
  if (!dl || !ville) return;
  const quartiers = getQuartiersByVille(ville);
  dl.innerHTML = quartiers.map(q => `<option value="${q}">`).join('');
};

// ================================================================
// Équipements toggle
// ================================================================
window.toggleEquip = function(el) {
  el.classList.toggle('selected');
  const check = el.querySelector('.equipement-check');
  if (el.classList.contains('selected')) {
    if (check) { check.innerHTML = '<i data-lucide="check" class="icon icon--sm"></i>'; if (window.renderIcons) window.renderIcons(); }
  } else {
    if (check) check.textContent = '';
  }
};

// ================================================================
// Gestion photos
// ================================================================
window.handlePhotos = async function(input) {
  const files = [...input.files];
  const remaining = 10 - state.photos.length;
  const toProcess = files.slice(0, remaining);

  for (const file of toProcess) {
    const compressed = await compressImage(file, 0.75, 1200);
    const url = URL.createObjectURL(compressed);
    state.photos.push(url);
    state.photoFiles.push(compressed);
  }

  renderPhotoPreview();
  const err = document.getElementById('err-photos');
  if (err && state.photos.length >= 3) err.classList.remove('show');
  input.value = '';
};

async function compressImage(file, quality = 0.75, maxSize = 1200) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
    };
    img.src = URL.createObjectURL(file);
  });
}

function renderPhotoPreview() {
  const grid = document.getElementById('photo-preview');
  if (!grid) return;
  grid.innerHTML = state.photos.map((url, i) => `
    <div class="photo-thumb">
      <img src="${url}" alt="Photo ${i + 1}">
      <button class="photo-thumb-remove" onclick="removePhoto(${i})">✕</button>
    </div>
  `).join('');

  if (state.photos.length < 10) {
    grid.insertAdjacentHTML('beforeend', `
      <div class="photo-add" onclick="document.getElementById('photo-input').click()">
        <span class="photo-add-icon"><i data-lucide="camera" class="icon icon--lg"></i></span>
        <span>${state.photos.length}/10</span>
      </div>
    `);
  }
  if (window.renderIcons) window.renderIcons();
}

window.removePhoto = function(idx) {
  state.photos.splice(idx, 1);
  state.photoFiles.splice(idx, 1);
  renderPhotoPreview();
};

// ================================================================
// Récapitulatif étape 5
// ================================================================
function renderRecap() {
  const recap = document.getElementById('recap-annonce');
  if (!recap) return;
  recap.innerHTML = `
    <div style="display:grid;gap:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <span>${logementIcon(state.type, 'icon--xl')}</span>
        <div>
          <div style="font-weight:600">${LOGEMENT_LABEL[state.type] || state.type} — ${state.quartier}, ${state.ville}</div>
          <div style="font-size:1.25rem;font-weight:700;color:var(--green)">${formatFCFA(state.loyer)}/mois</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${state.meuble ? '<span class="badge badge-ink">Meublé</span>' : ''}
        ${state.eau ? '<span class="badge badge-green">Eau incluse</span>' : ''}
        ${state.elec ? '<span class="badge badge-green">Élec incluse</span>' : ''}
        ${state.etudiant ? '<span class="badge badge-ink">Étudiant OK</span>' : ''}
        ${state.photos.length ? `<span class="badge badge-ink"><i data-lucide="camera" class="icon icon--sm"></i> ${state.photos.length} photos</span>` : ''}
      </div>
      <div style="font-size:0.875rem;color:var(--ink-mid)">Caution : ${state.caution} mois · ${formatFCFA(state.loyer * state.caution)}</div>
    </div>
  `;
  if (window.renderIcons) window.renderIcons();
}

// ================================================================
// Publication
// ================================================================
window.publierAnnonce = async function() {
  state.boost = document.getElementById('pub-boost')?.checked || false;

  const user = await getCurrentUser();
  if (!user) { window.location.hash = '#auth'; return; }

  const btn = document.getElementById('btn-publier');
  if (btn) { btn.disabled = true; btn.textContent = 'Publication...'; }

  try {
    // Upload photos vers Supabase Storage
    const photoUrls = [];
    for (let i = 0; i < state.photoFiles.length; i++) {
      const file = state.photoFiles[i];
      const path = `${user.id}/${Date.now()}_${i}.jpg`;
      console.log(`[UPLOAD] Photo ${i + 1}/${state.photoFiles.length} — taille: ${Math.round(file.size / 1024)}ko — chemin: ${path}`);

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('logement-photos')
        .upload(path, file, { contentType: 'image/jpeg', upsert: false });

      if (uploadErr) {
        console.error(`[UPLOAD] Erreur photo ${i + 1}:`, uploadErr.message, uploadErr);
        throw new Error(`Upload photo ${i + 1} : ${uploadErr.message}`);
      }

      const { data: { publicUrl } } = supabase.storage.from('logement-photos').getPublicUrl(path);
      console.log(`[UPLOAD] Photo ${i + 1} OK — URL: ${publicUrl}`);
      photoUrls.push(publicUrl);
    }

    // Insérer le logement
    const { data: logement, error } = await supabase.from('logements').insert({
      bailleur_id: user.id,
      titre: `${LOGEMENT_LABEL[state.type] || state.type} à ${state.quartier}`,
      description: state.description || null,
      type: state.type,
      statut: 'en_moderation',
      loyer_mensuel: state.loyer,
      caution_mois: state.caution,
      surface_m2: state.surface,
      meuble: state.meuble,
      type_bail: state.bail,
      ville: state.ville,
      quartier: state.quartier,
      adresse_complete: state.adresse || null,
      latitude: state.lat,
      longitude: state.lng,
      eau_incluse: state.eau,
      electricite_incluse: state.elec,
      equipements: state.equipements,
      photos: photoUrls,
      badge_etudiant: state.etudiant,
      score_completude: 0,
    }).select().single();

    if (error) throw new Error(error.message);

    if (state.boost) {
      window.location.hash = `#payment-caution?logement_id=${logement.id}&type=boost&montant=2000`;
    } else {
      showToast('Annonce soumise — validée sous 24h ✓', 'success', 5000);
      window.location.hash = '#mes-annonces';
    }

  } catch (err) {
    showToast(`Erreur : ${err.message}`, 'error', 5000);
    if (btn) { btn.disabled = false; btn.textContent = 'Publier'; }
  }
};

// ================================================================
// Géolocalisation
// ================================================================
function initGeolocation() {
  const btn = document.getElementById('btnGeoloc');
  const status = document.getElementById('geolocStatus');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Géolocalisation non supportée par ce navigateur', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Localisation en cours...';
    if (status) { status.style.display = 'block'; status.textContent = 'Recherche de votre position...'; }

    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) => {
        state.lat = latitude;
        state.lng = longitude;
        const latEl = document.getElementById('pub-lat');
        const lngEl = document.getElementById('pub-lng');
        if (latEl) latEl.value = latitude;
        if (lngEl) lngEl.value = longitude;

        if (publishMap) {
          publishMap.setView([latitude, longitude], 16);
          if (publishMarker) publishMarker.remove();
          publishMarker = L.marker([latitude, longitude], { draggable: true }).addTo(publishMap);
          publishMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            state.lat = pos.lat;
            state.lng = pos.lng;
            if (latEl) latEl.value = pos.lat;
            if (lngEl) lngEl.value = pos.lng;
          });
        }

        reverseGeocode(latitude, longitude);

        btn.disabled = false;
        btn.textContent = 'Position définie';
        if (status) status.textContent = `Coordonnées : ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        showToast('Position actuelle enregistrée', 'success');
      },
      (err) => {
        btn.disabled = false;
        btn.textContent = 'Utiliser ma position actuelle';
        let msg = 'Impossible de récupérer votre position';
        if (err.code === err.PERMISSION_DENIED) msg = 'Autorisation refusée — activez-la dans les paramètres du navigateur.';
        if (err.code === err.TIMEOUT) msg = 'La recherche de position a expiré, réessayez.';
        if (status) { status.style.display = 'block'; status.textContent = msg; }
        showToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
      { headers: { 'Accept-Language': 'fr' } }
    );
    const data = await res.json();
    const suburb = data.address?.suburb || data.address?.neighbourhood || data.address?.quarter || '';
    const quartierInput = document.getElementById('pub-quartier');
    if (suburb && quartierInput && !quartierInput.value) {
      quartierInput.value = suburb;
    }
  } catch (e) {
    console.error('Reverse geocoding échoué (non bloquant) :', e);
  }
}

// ================================================================
// Init
// ================================================================
export function init() {
  // Init carte localisation
  if (window.L) {
    publishMap = L.map('publish-map', { zoomControl: true }).setView([6.3702, 2.3912], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(publishMap);

    publishMap.on('click', (e) => {
      const { lat, lng } = e.latlng;
      state.lat = lat;
      state.lng = lng;
      document.getElementById('pub-lat').value = lat;
      document.getElementById('pub-lng').value = lng;
      if (publishMarker) publishMarker.remove();
      publishMarker = L.marker([lat, lng], { draggable: true }).addTo(publishMap);
      publishMarker.on('dragend', (ev) => {
        const pos = ev.target.getLatLng();
        state.lat = pos.lat;
        state.lng = pos.lng;
        document.getElementById('pub-lat').value = pos.lat;
        document.getElementById('pub-lng').value = pos.lng;
      });
    });
  }

  // Bouton géolocalisation
  initGeolocation();

  // Init autocomplete quartiers
  updateQuartiers();
  renderPhotoPreview();
}
