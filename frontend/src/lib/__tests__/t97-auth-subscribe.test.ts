import { beforeEach, describe, expect, it } from "vitest";
import { clearAuth, getUser, saveAuth, subscribeAuth } from "../auth";

const user = { id: 1, username: "taichi", email: "taichi@example.com" };

describe("T-97 (Issue #26): 認証状態の購読", () => {
  beforeEach(() => {
    clearAuth();
  });

  it("saveAuthは購読者へ新しいユーザーを通知する", () => {
    const received: Array<{ id: number; username: string; email: string } | null> = [];
    subscribeAuth((u) => received.push(u));

    saveAuth("token-1", user);

    expect(received).toEqual([user]);
  });

  it("clearAuthは購読者へnullを通知する", () => {
    const received: Array<{ id: number; username: string; email: string } | null> = [];
    saveAuth("token-1", user);
    subscribeAuth((u) => received.push(u));

    clearAuth();

    expect(received).toEqual([null]);
  });

  it("購読解除後は通知されない", () => {
    const received: Array<{ id: number; username: string; email: string } | null> = [];
    const unsubscribe = subscribeAuth((u) => received.push(u));

    unsubscribe();
    saveAuth("token-1", user);

    expect(received).toEqual([]);
  });

  it("saveAuthはlocalStorageにも保存し、getUserで読み直せる", () => {
    saveAuth("token-1", user);
    expect(getUser()).toEqual(user);
  });

  it("複数購読者がいる場合、全員に通知される", () => {
    const a: Array<{ id: number; username: string; email: string } | null> = [];
    const b: Array<{ id: number; username: string; email: string } | null> = [];
    subscribeAuth((u) => a.push(u));
    subscribeAuth((u) => b.push(u));

    saveAuth("token-1", user);

    expect(a).toEqual([user]);
    expect(b).toEqual([user]);
  });
});
