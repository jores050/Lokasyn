// ================================================================
// LocaSyn — auth.js
// Gestion authentification Supabase
// ================================================================

import supabase from './supabase.js';
import store from './store.js';
import { showToast, validateTelBenin } from './utils.js';

// ----------------------------------------------------------------
// Récupérer l'utilisateur courant (avec cache)
// ----------------------------------------------------------------
export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

// ----------------------------------------------------------------
// Récupérer le profil courant
// ----------------------------------------------------------------
export async function getCurrentProfile() {
  const cached = store.get('profile');
  if (cached) return cached;

  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  store.set('profile', data);
  return data;
}

// ----------------------------------------------------------------
// Post-auth : créer le profil si inexistant
// ----------------------------------------------------------------
async function handleAuthSuccess(user) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!existing) {
    const role = sessionStorage.getItem('locasyn_role') || 'locataire';
    const meta = user.user_metadata || {};
    await supabase.from('profiles').insert({
      id: user.id,
      role,
      nom: meta.nom || meta.full_name?.split(' ').slice(-1)[0] || '',
      prenom: meta.prenom || meta.full_name?.split(' ')[0] || '',
      telephone: meta.telephone || '',
    });
    sessionStorage.removeItem('locasyn_role');
  }

  // Charger profil dans le store
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) {
    store.set('user', user);
    store.set('profile', profile);
  }

  window.location.hash = '#home';
}

// ----------------------------------------------------------------
// Inscription
// ----------------------------------------------------------------
export async function signUp({ email, password, nom, prenom, telephone, role }) {
  if (telephone && !validateTelBenin(telephone)) {
    throw new Error('Numéro de téléphone invalide (format béninois requis)');
  }

  sessionStorage.setItem('locasyn_role', role);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nom, prenom, telephone },
    },
  });

  if (error) throw new Error(error.message);

  if (data.user && !data.user.identities?.length) {
    throw new Error('Un compte existe déjà avec cet email');
  }

  if (data.session) {
    await handleAuthSuccess(data.user);
  } else {
    showToast('Vérifiez votre email pour confirmer votre compte', 'info', 5000);
  }

  return data;
}

// ----------------------------------------------------------------
// Connexion
// ----------------------------------------------------------------
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('Invalid login')) {
      throw new Error('Email ou mot de passe incorrect');
    }
    throw new Error(error.message);
  }
  await handleAuthSuccess(data.user);
  return data;
}

// ----------------------------------------------------------------
// Déconnexion
// ----------------------------------------------------------------
export async function signOut() {
  await supabase.auth.signOut();
  store.set('user', null);
  store.set('profile', null);
  store.loadFavorites([]);
  window.location.hash = '#home';
}

// ----------------------------------------------------------------
// Réinitialisation mot de passe
// ----------------------------------------------------------------
export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/#reset-password`,
  });
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------
// Observer les changements d'état auth
// ----------------------------------------------------------------
export function initAuthListener() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      store.set('user', session.user);
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (profile) store.set('profile', profile);
      await loadUserFavorites(session.user.id);
    } else if (event === 'SIGNED_OUT') {
      store.set('user', null);
      store.set('profile', null);
      store.loadFavorites([]);
    } else if (event === 'TOKEN_REFRESHED' && session) {
      store.set('user', session.user);
    }
  });
}

// ----------------------------------------------------------------
// Charger les favoris de l'utilisateur
// ----------------------------------------------------------------
async function loadUserFavorites(userId) {
  const { data } = await supabase
    .from('favoris')
    .select('logement_id')
    .eq('utilisateur_id', userId);

  if (data) {
    store.loadFavorites(data.map(f => f.logement_id));
  }
}

// ----------------------------------------------------------------
// Toggle favori (DB + store)
// ----------------------------------------------------------------
export async function toggleFavori(logementId) {
  const user = await getCurrentUser();
  if (!user) {
    showToast('Connectez-vous pour sauvegarder des favoris', 'warning');
    window.location.hash = '#auth';
    return false;
  }

  const isFav = store.isFavorite(logementId);

  if (isFav) {
    await supabase.from('favoris')
      .delete()
      .eq('utilisateur_id', user.id)
      .eq('logement_id', logementId);
  } else {
    await supabase.from('favoris').insert({
      utilisateur_id: user.id,
      logement_id: logementId,
    });
  }

  return store.toggleFavorite(logementId);
}

// ----------------------------------------------------------------
// Initialisation auth au chargement
// ----------------------------------------------------------------
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    store.set('user', session.user);
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (profile) store.set('profile', profile);
    await loadUserFavorites(session.user.id);
  }
  initAuthListener();
}
