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
    return { ...structuredClone(DEFAULT_PROFILE), ...p };
  } catch {
    return structuredClone(DEFAULT_PROFILE);
  }
}

export function saveProfile(p: Profile): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(KEY, JSON.stringify(p));
  }
}

export function exportProfile(): string {
  const storage = getStorage();
  return storage?.getItem(KEY) ?? JSON.stringify(DEFAULT_PROFILE);
}
