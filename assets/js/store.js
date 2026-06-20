// ================================================================
// LocaSyn — store.js
// State management global (vanilla)
// ================================================================

const _state = {
  user: null,
  profile: null,
  notifications: [],
  unreadCount: 0,
  favorites: new Set(),
  currentConversation: null,
};

const _listeners = new Map();

function emit(key) {
  const fns = _listeners.get(key) || [];
  fns.forEach(fn => fn(_state[key]));
}

export const store = {
  get(key) {
    return _state[key];
  },

  set(key, value) {
    _state[key] = value;
    emit(key);
  },

  subscribe(key, fn) {
    if (!_listeners.has(key)) _listeners.set(key, []);
    _listeners.get(key).push(fn);
    return () => {
      const fns = _listeners.get(key) || [];
      _listeners.set(key, fns.filter(f => f !== fn));
    };
  },

  // Helpers favoris
  isFavorite(logementId) {
    return _state.favorites.has(logementId);
  },

  toggleFavorite(logementId) {
    if (_state.favorites.has(logementId)) {
      _state.favorites.delete(logementId);
    } else {
      _state.favorites.add(logementId);
    }
    emit('favorites');
    return _state.favorites.has(logementId);
  },

  loadFavorites(ids = []) {
    _state.favorites = new Set(ids);
    emit('favorites');
  },
};

export default store;
