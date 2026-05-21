import Link from "next/link";
import { REFERENCES } from "@/lib/mock-references";

// 固定艇種リスト（人気順）
const CLASS_SLUGS = ["470", "snipe", "ilca", "49er", "420", "op"];

// 艇種ごとの関連technique slugs（上位3件）
const CLASS_TECHNIQUES: Record<string, string[]> = {
  "470":   ["close-hauled", "tacking", "spinnaker"],
  "snipe": ["close-hauled", "roll-tack", "mark-rounding"],
  "ilca":  ["close-hauled", "planing", "hiking"],
  "49er":  ["trapeze", "spinnaker", "planing"],
  "420":   ["close-hauled", "tacking", "starting"],
  "op":    ["close-hauled", "tacking", "starting"],
};

const CLASS_COLOR: Record<string, string> = {
  "470":   "var(--class-470, var(--terra))",
  "snipe": "var(--class-snipe, var(--dijon))",
  "ilca":  "var(--class-ilca, var(--sage))",
  "49er":  "var(--class-49er, #4A7CB5)",
  "420":   "var(--class-420, var(--sage))",
  "op":    "var(--terra)",
};

const CLASS_LABEL: Record<string, string> = {
  "470":   "470",
  "snipe": "Snipe",
  "ilca":  "ILCA",
  "49er":  "49er",
  "420":   "420",
  "op":    "OP",
};

// 今日の日付から固定の艇種を決める（全員共通・毎週変わる）
function getTodayClassSlug(): string {
  const weekIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7)) % CLASS_SLUGS.length;
  return CLASS_SLUGS[weekIndex];
}

export default function ClassFocusTile() {
  const slug = getTodayClassSlug();
  const classRef = REFERENCES.find((r) => r.slug === slug && r.category === "boat_class");
  const techniqueSlugs = CLASS_TECHNIQUES[slug] ?? [];
  const techniques = techniqueSlugs
    .map((s) => REFERENCES.find((r) => r.slug === s))
    .filter(Boolean) as typeof REFERENCES;
  const accentColor = CLASS_COLOR[slug] ?? "var(--terra)";

  return (
    <div
      className="bento-tile bento-tile-span2 bento-tile-h2"
      style={{ borderTop: `3px solid ${accentColor}`, paddingTop: "1.1rem" }}
    >
      <div className="bento-tile-label">
        <span className="bento-tile-label-dot" style={{ background: accentColor }} />
        CLASS FOCUS — {CLASS_LABEL[slug] ?? slug.toUpperCase()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", flex: 1 }}>
        {/* 左: 艇種概要 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <Link
            href={`/reference/${slug}`}
            style={{ textDecoration: "none" }}
          >
            <h2 style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              fontWeight: 500,
              color: accentColor,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              marginBottom: "0.1rem",
            }}>
              {CLASS_LABEL[slug] ?? slug.toUpperCase()}
            </h2>
            {classRef?.titleEn && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--fg-dim)", marginBottom: "0.65rem" }}>
                {classRef.titleEn}
              </p>
            )}
          </Link>
          {classRef && (
            <p style={{ fontSize: "0.875rem", color: "var(--fg-mute)", lineHeight: 1.65, flex: 1 }}>
              {classRef.summary.slice(0, 120)}{classRef.summary.length > 120 ? "…" : ""}
            </p>
          )}
          <Link
            href={`/reference/${slug}`}
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: accentColor, fontWeight: 600, marginTop: "auto" }}
          >
            Class Reference →
          </Link>
        </div>

        {/* 右: 関連テクニック */}
        <div style={{ borderLeft: "1px solid var(--border)", paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", fontWeight: 600, color: "var(--fg-dim)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.85rem" }}>
            Key Techniques
          </p>
          {techniques.length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "var(--fg-mute)" }}>—</p>
          ) : (
            techniques.map((t, i) => (
              <Link
                key={t.slug}
                href={`/reference/${t.slug}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.65rem 0",
                  borderBottom: i < techniques.length - 1 ? "1px solid var(--border)" : "none",
                  textDecoration: "none",
                }}
              >
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  color: accentColor,
                  background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                  padding: "0.15rem 0.45rem",
                  borderRadius: 3,
                  flexShrink: 0,
                  lineHeight: 1.6,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)", lineHeight: 1.3 }}>
                    {t.title}
                  </div>
                  {t.titleEn && (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--fg-dim)", marginTop: "0.1rem" }}>
                      {t.titleEn}
                    </div>
                  )}
                </div>
              </Link>
            ))
          )}
          <Link
            href={`/reference?category=technique`}
            style={{ marginTop: "auto", paddingTop: "0.75rem", fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--fg-dim)" }}
          >
            All Techniques →
          </Link>
        </div>
      </div>
    </div>
  );
}
