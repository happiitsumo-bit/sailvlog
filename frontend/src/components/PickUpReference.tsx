import Link from "next/link";
import { REFERENCES, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/mock-references";

export default function PickUpReference() {
  // サーバーサイドで毎日変わるエントリを選ぶ（日付ベースのシード）
  const dayIndex = new Date().getDate() % REFERENCES.length;
  const ref = REFERENCES[dayIndex];

  const categoryColor: Record<string, string> = {
    boat_class: "var(--terra)",
    technique:  "var(--sage)",
    rule:       "var(--dijon)",
    gear:       "var(--fg-mute)",
  };

  return (
    <div className="bento-tile bento-tile-h1" style={{ borderLeft: `3px solid ${categoryColor[ref.category] ?? "var(--terra)"}` }}>
      <div className="bento-tile-label">
        <span className="bento-tile-label-dot" style={{ background: categoryColor[ref.category] }} />
        PICK UP REFERENCE
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.01em", marginBottom: "0.2rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {ref.title}
          </h2>
          {ref.titleEn && (
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--fg-dim)", marginBottom: "0.5rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {ref.titleEn}
            </p>
          )}
          <p style={{ fontSize: "0.82rem", color: "var(--fg-mute)", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {ref.summary}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end", flexShrink: 0 }}>
          <span
            className="ref-badge ref-badge-category"
            data-category={ref.category}
          >
            {CATEGORY_LABEL[ref.category]}
          </span>
          <span
            className="ref-badge ref-badge-level"
            data-level={ref.level}
          >
            {LEVEL_LABEL[ref.level]}
          </span>
        </div>
      </div>

      <Link
        href={`/reference/${ref.slug}`}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", marginTop: "1rem", fontSize: "0.82rem", fontFamily: "var(--font-mono)", color: "var(--terra)", fontWeight: 600 }}
      >
        詳しく読む →
      </Link>
    </div>
  );
}
