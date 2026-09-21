export interface Analysis {
  id: string;
  date: number;
  depth: number;
  rows: unknown[];
}

export interface SavedGame {
  id: string;
  pgn: string;
  date: number;
  result: string;
  analyses: Analysis[];
  note: string;
}

const LEGACY_KEY = "games.v1";
const DB_NAME = "chess-coach";
const STORE = "games";
const CHANNEL = "chess-coach-games";

// Sync in-memory view (keeps the external-store API synchronous for pages).
// Durable writes go to IndexedDB; localStorage is only a legacy seed and a
// fallback when IndexedDB is unavailable (SSR, private mode, old browsers).
let mem: SavedGame[] | null = null;

function readLegacy(): SavedGame[] {
  try {
    if (typeof localStorage === "undefined") return [];
    return JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeLegacy(g: SavedGame[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(LEGACY_KEY, JSON.stringify(g));
  } catch {
    // quota exceeded: IndexedDB remains the source of truth when available
  }
}

function memGames(): SavedGame[] {
  if (mem === null) mem = readLegacy();
  return mem;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function dbReady(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = typeof window === "undefined" ? Promise.resolve(null) : openDb();
  }
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistDb(): Promise<void> {
  const games = memGames();
  const db = await dbReady();
  if (!db) {
    writeLegacy(games);
    return;
  }
  try {
    await tx(db, "readwrite", (s) => {
      s.clear();
      for (const g of games) s.put(g);
      return s.getAll();
    });
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
    channel()?.postMessage("changed");
  } catch {
    writeLegacy(games);
  }
}

// Load durable state into memory (runs once on import in the browser).
export async function hydrateGames(): Promise<void> {
  const db = await dbReady();
  if (db) {
    try {
      const stored = await tx<SavedGame[]>(db, "readonly", (s) => s.getAll());
      if (stored.length > 0) {
        mem = stored;
      } else {
        const legacy = readLegacy();
        if (legacy.length > 0) {
          mem = legacy;
          cachedGames = null;
          await persistDb();
        }
      }
      try {
        if (typeof localStorage !== "undefined") localStorage.removeItem(LEGACY_KEY);
      } catch {
        // ignore
      }
    } catch {
      // keep sync memory view as-is
    }
  }
  notifyGamesListeners();
}

async function rehydrate(): Promise<void> {
  const db = await dbReady();
  if (!db) return;
  try {
    mem = await tx<SavedGame[]>(db, "readonly", (s) => s.getAll());
  } catch {
    // keep current view
  }
  notifyGamesListeners();
}

let bc: BroadcastChannel | null | undefined;
function channel(): BroadcastChannel | null {
  if (bc !== undefined || typeof BroadcastChannel === "undefined") return bc ?? null;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = () => {
      void rehydrate();
    };
  } catch {
    bc = null;
  }
  return bc;
}

export function saveGame(pgn: string): string {
  const games = memGames();
  const id = crypto.randomUUID();
  const result = pgn.includes("1-0") ? "1-0" : pgn.includes("0-1") ? "0-1" : "1/2-1/2";
  games.unshift({ id, pgn, date: Date.now(), result, analyses: [], note: "" });
  void persistDb();
  refreshCache();
  return id;
}

const gamesListeners = new Set<() => void>();

function notifyGamesListeners() {
  for (const l of gamesListeners) l();
}

let cachedGames: SavedGame[] | null = null;

export function subscribeGames(listener: () => void): () => void {
  gamesListeners.add(listener);
  return () => {
    gamesListeners.delete(listener);
  };
}

export function getGamesSnapshot(): SavedGame[] {
  if (cachedGames === null) {
    cachedGames = memGames();
  }
  return cachedGames;
}

function refreshCache(): SavedGame[] {
  cachedGames = memGames();
  notifyGamesListeners();
  return cachedGames;
}

export function listGames(): SavedGame[] {
  return memGames();
}

export function getGame(id: string): SavedGame | undefined {
  return memGames().find((x) => x.id === id);
}

export function addAnalysis(id: string, a: Omit<Analysis, "id" | "date">): void {
  const games = memGames();
  const g = games.find((x) => x.id === id);
  if (!g) return;
  g.analyses.push({ ...a, id: crypto.randomUUID(), date: Date.now() });
  void persistDb();
  refreshCache();
}

export function setNote(id: string, note: string): void {
  const games = memGames();
  const g = games.find((x) => x.id === id);
  if (!g) return;
  g.note = note;
  void persistDb();
  refreshCache();
}

export function deleteGame(id: string): void {
  mem = memGames().filter((g) => g.id !== id);
  void persistDb();
  refreshCache();
}

// Test-only: drop the in-memory view and close the DB handle so the next
// read re-seeds (legacy or IDB). Await before deleteDatabase/re-import.
export async function clearMemoryCache(): Promise<void> {
  mem = null;
  cachedGames = null;
  const db = await dbReady();
  dbPromise = null;
  try {
    db?.close();
  } catch {
    // ignore
  }
}

if (typeof window !== "undefined") {
  void hydrateGames();
}
