import { describe, expect, it, vi } from "vitest";
import {
  handlePublicSessionErrorStatus,
  PublicSessionUnavailableError,
  publicSessionNetworkError,
  PUBLIC_SESSION_RETRY_GUIDANCE,
  PUBLIC_SESSION_UNAVAILABLE_TITLE,
} from "../publicSession";

describe("T-29: 公開セッション取得の失敗種別", () => {
  it("404だけはnotFound()を呼ぶ", () => {
    const notFound = vi.fn((): never => {
      throw new Error("NEXT_NOT_FOUND");
    });

    expect(() => handlePublicSessionErrorStatus(404, notFound)).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it.each([429, 500])("%iは404にせず、一時的な表示不可として再試行を案内する", (status) => {
    const notFound = vi.fn((): never => {
      throw new Error("NEXT_NOT_FOUND");
    });

    expect(() => handlePublicSessionErrorStatus(status, notFound)).toThrow(
      PublicSessionUnavailableError
    );
    expect(notFound).not.toHaveBeenCalled();
    expect(PUBLIC_SESSION_UNAVAILABLE_TITLE).toBe("一時的に表示できません");
    expect(PUBLIC_SESSION_RETRY_GUIDANCE).toContain("もう一度お試しください");
  });

  it("ネットワーク例外も404にせず、一時的な表示不可として再試行を案内する", () => {
    const cause = new TypeError("fetch failed");
    const error = publicSessionNetworkError(cause);

    expect(error).toBeInstanceOf(PublicSessionUnavailableError);
    expect(error.status).toBeNull();
    expect(error.cause).toBe(cause);
    expect(error.message).toBe("一時的に表示できません");
    expect(PUBLIC_SESSION_RETRY_GUIDANCE).toContain("もう一度お試しください");
  });
});
