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

const KEY = "games.v1";

function read(): SavedGame[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(g: SavedGame[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(g));
}

export function saveGame(pgn: string): string {
  const games = read();
  const id = crypto.randomUUID();
  const result = pgn.includes("1-0") ? "1-0" : pgn.includes("0-1") ? "0-1" : "1/2-1/2";
  games.unshift({ id, pgn, date: Date.now(), result, analyses: [], note: "" });
  write(games);
  return id;
}

export function listGames(): SavedGame[] {
  return read();
}

export function getGame(id: string): SavedGame | undefined {
  return read().find((x) => x.id === id);
}

export function addAnalysis(id: string, a: Omit<Analysis, "id" | "date">): void {
  const games = read();
  const g = games.find((x) => x.id === id);
  if (!g) return;
  g.analyses.push({ ...a, id: crypto.randomUUID(), date: Date.now() });
  write(games);
}

export function setNote(id: string, note: string): void {
  const games = read();
  const g = games.find((x) => x.id === id);
  if (!g) return;
  g.note = note;
  write(games);
}

export function deleteGame(id: string): void {
  const games = read().filter((g) => g.id !== id);
  write(games);
}
