import type { Profile } from "./update";
export type { Profile };
export { applyPostgame, type PostgameResult } from "./update";

const KEY = "profile.v1";
export const DEFAULT_PROFILE: Profile = {
  version: 1,
  rating: 800,
  games: 0,
  errorTags: { tactics: 0, kingSafety: 0, endgame: 0, pawns: 0 },
  recentErrorFens: [],
  openings: {},
  phaseHistory: [],
};

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return undefined;
}

let cachedProfile: Profile | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const l of listeners) l();
}

export function subscribeProfile(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getProfileSnapshot(): Profile {
  if (cachedProfile === null) {
    cachedProfile = loadProfile();
  }
  return cachedProfile;
}

export function loadProfile(): Profile {
  const storage = getStorage();
  if (!storage) return structuredClone(DEFAULT_PROFILE);
  const raw = storage.getItem(KEY);
  if (!raw) return structuredClone(DEFAULT_PROFILE);
  try {
    const p = JSON.parse(raw);
    if (p.version !== 1) {
      storage.setItem(KEY + ".bak", raw); // backup before migrate
      return structuredClone(DEFAULT_PROFILE);
    }
    // Guard against stale/malformed persisted shape (e.g. errorTags null/array)
    const next = { ...structuredClone(DEFAULT_PROFILE), ...p };
    next.errorTags = { ...structuredClone(DEFAULT_PROFILE.errorTags), ...(p.errorTags ?? {}) };
    next.phaseHistory = Array.isArray(p.phaseHistory) ? p.phaseHistory : structuredClone(DEFAULT_PROFILE.phaseHistory);
    next.recentErrorFens = Array.isArray(p.recentErrorFens)
      ? p.recentErrorFens
      : structuredClone(DEFAULT_PROFILE.recentErrorFens);
    return next;
  } catch {
    return structuredClone(DEFAULT_PROFILE);
  }
}

export function saveProfile(p: Profile): void {
  cachedProfile = p;
  const storage = getStorage();
  if (storage) {
    storage.setItem(KEY, JSON.stringify(p));
  }
  notifyListeners();
}


export function exportProfile(): string {
  const storage = getStorage();
  return storage?.getItem(KEY) ?? JSON.stringify(DEFAULT_PROFILE);
}
