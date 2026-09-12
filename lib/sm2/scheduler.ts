export interface Card {
  id: string;
  fen: string;
  bestMove: string;
  context: string;
  EF: number;
  interval: number;
  reps: number;
  nextReview: number;
}

const KEY = "cards.v1";
const DAY = 86400000;

export function reviewCard(c: Card, quality: 5 | 4 | 2 | 0): Card {
  const next = { ...c };
  if (quality < 3) {
    next.reps = 0;
    next.interval = 1;
  } else {
    next.EF = Math.max(1.3, next.EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    next.reps += 1;
    next.interval = next.reps === 1 ? 1 : next.reps === 2 ? 6 : Math.round(next.interval * next.EF);
  }
  next.nextReview = Date.now() + next.interval * DAY;
  return next;
}

export function dueCards(cards: Card[], now = Date.now()): Card[] {
  return cards.filter((c) => c.nextReview <= now).sort((a, b) => a.nextReview - b.nextReview);
}

export interface DueSummary {
  total: number;
  due: number;
  fresh: number;
  byContext: { context: string; due: number }[];
}

export function summarizeDue(cards: Card[], now = Date.now()): DueSummary {
  const due = dueCards(cards, now);
  const byMap = new Map<string, number>();
  for (const c of due) byMap.set(c.context || "Tática", (byMap.get(c.context || "Tática") ?? 0) + 1);
  return {
    total: cards.length,
    due: due.length,
    fresh: cards.filter((c) => c.reps === 0).length,
    byContext: [...byMap.entries()]
      .map(([context, d]) => ({ context, due: d }))
      .sort((a, b) => b.due - a.due),
  };
}

let cachedCards: Card[] = [];
let lastRaw: string | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      lastRaw = null;
      notifyListeners();
    }
  });
}

export function subscribeCards(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCardsSnapshot(): Card[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [];
  }
  const raw = localStorage.getItem(KEY);
  if (raw !== lastRaw) {
    lastRaw = raw;
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      cachedCards = Array.isArray(parsed) ? (parsed as Card[]) : [];
    } catch {
      cachedCards = [];
    }
  }
  return cachedCards;
}

export const EMPTY_CARDS: Card[] = [];

export function loadCards(): Card[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [];
  }
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveCards(cards: Card[]): void {
  cachedCards = cards;
  const serialized = JSON.stringify(cards);
  lastRaw = serialized;
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    notifyListeners();
    return;
  }
  localStorage.setItem(KEY, serialized);
  notifyListeners();
}

export function addCard(input: Pick<Card, "fen" | "bestMove" | "context">, quality?: 5 | 4 | 2 | 0): void {
  const cards = loadCards().filter((c) => c.fen !== input.fen);
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const fresh: Card = { ...input, id, EF: 2.5, interval: 0, reps: 0, nextReview: 0 };
  saveCards([...cards, quality === undefined ? fresh : reviewCard(fresh, quality)]);
}
