"use client";

// M-3(Issue #42): /sessions のチーム選択が保持されない問題への対応。
// 所属チームが1件ならURLパラメータ無しでも自動選択し、複数ある場合は直近の選択を
// localStorageに保持して次回訪問時に復元する（auth.tsと同じstorageフォールバック方針）。

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function createMemoryStorage(): KeyValueStorage {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

const memoryStorage = createMemoryStorage();

function getStorage(): KeyValueStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

export const LAST_TEAM_ID_STORAGE_KEY = "sailvlog:lastTeamId";

export function readLastTeamId(): number | null {
  const raw = getStorage().getItem(LAST_TEAM_ID_STORAGE_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export function writeLastTeamId(teamId: number): void {
  getStorage().setItem(LAST_TEAM_ID_STORAGE_KEY, String(teamId));
}

/** URLにteamId指定が無いとき、どのチームを自動選択すべきか（純関数）。
    優先順位: 1) 直近選択が現メンバーシップに残っていればそれ 2) 所属が1件だけならそれ 3) 無し(null)。 */
export function resolveAutoSelectedTeamId(teamIds: number[], lastTeamId: number | null): number | null {
  if (lastTeamId !== null && teamIds.includes(lastTeamId)) return lastTeamId;
  if (teamIds.length === 1) return teamIds[0];
  return null;
}
