import type { ChatMessage } from "@/lib/coach/schemas";
export type { ChatMessage };

const KEY = "chat.v1";

function getStorage(): Storage | undefined {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  return undefined;
}

export function loadChat(): ChatMessage[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveChat(messages: ChatMessage[]): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(KEY, JSON.stringify(messages.slice(-50)));
}

export function appendMessage(msg: ChatMessage): ChatMessage[] {
  const current = loadChat();
  const next = [...current, msg].slice(-50);
  saveChat(next);
  return next;
}

export function clearChat(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(KEY);
}
