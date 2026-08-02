"use client";

export type AuthUser = { id: number; username: string; email: string };
export type AuthListener = (user: AuthUser | null) => void;

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function createMemoryStorage(): KeyValueStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

// Vitest(jsdom)環境ではwindow.localStorageが利用できないため、フォールバックとして
// メモリストレージを使う（テスト可能性の確保）。ブラウザ実行時は通常のlocalStorageを使う。
const memoryStorage = createMemoryStorage();

function getStorage(): KeyValueStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

// T-97 (Issue #26): 認証状態の正本。TopBarはlayout.tsxに置かれ画面遷移で
// 再マウントされないため、saveAuth/clearAuthが購読者へ直接通知することで
// クライアント側ナビゲーション（router.push）後も表示を更新できるようにする。
const listeners = new Set<AuthListener>();

function notify(user: AuthUser | null) {
  for (const listener of listeners) {
    listener(user);
  }
}

export function subscribeAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function saveAuth(token: string, user: AuthUser) {
  const storage = getStorage();
  storage.setItem("token", token);
  storage.setItem("user", JSON.stringify(user));
  notify(user);
}

export function clearAuth() {
  const storage = getStorage();
  storage.removeItem("token");
  storage.removeItem("user");
  notify(null);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = getStorage().getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!getUser();
}
