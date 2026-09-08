const KEY = "coachQueue.v1";

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  return undefined;
}

export function enqueue(item: unknown): void {
  const storage = getStorage();
  if (!storage) return;
  const q = JSON.parse(storage.getItem(KEY) ?? "[]");
  storage.setItem(KEY, JSON.stringify([...q, item].slice(-50)));
}

export function drain<T>(): T[] {
  const storage = getStorage();
  if (!storage) return [];
  const q = JSON.parse(storage.getItem(KEY) ?? "[]");
  storage.removeItem(KEY);
  return q as T[];
}
