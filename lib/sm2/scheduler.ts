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
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(cards));
}

export function addCard(input: Pick<Card, "fen" | "bestMove" | "context">): void {
  const cards = loadCards();
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  saveCards([...cards, { ...input, id, EF: 2.5, interval: 0, reps: 0, nextReview: 0 }]);
}
