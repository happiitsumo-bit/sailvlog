import { describe, test, expect } from "vitest";
import { slugifyTeamName, isValidTeamSlug } from "../teamOnboarding";

describe("lib/teamOnboarding (T-34)", () => {
  test("slugifyTeamName: 日本語チーム名は英数字部分だけがハイフンで残る", () => {
    expect(slugifyTeamName("Tokyo Sailing Club")).toBe("tokyo-sailing-club");
    expect(slugifyTeamName("○○大学ヨット部")).toBe("");
    expect(slugifyTeamName("  Team--A!! ")).toBe("team-a");
  });

  test("isValidTeamSlug: backendのTEAM_SLUG_REと同じ条件で判定する", () => {
    expect(isValidTeamSlug("tokyo-sailing-club")).toBe(true);
    expect(isValidTeamSlug("ab")).toBe(false); // 3文字未満
    expect(isValidTeamSlug("-abc")).toBe(false); // 先頭ハイフン不可
    expect(isValidTeamSlug("abc-")).toBe(false); // 末尾ハイフン不可
    expect(isValidTeamSlug("Abc")).toBe(false); // 大文字不可
    expect(isValidTeamSlug("abc")).toBe(true);
  });
});
