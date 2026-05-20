import ReferenceCard from "@/components/ReferenceCard";
import { REFERENCES, ReferenceCategory, CATEGORY_LABEL } from "@/lib/mock-references";

const CATEGORIES: { value: ReferenceCategory | "all"; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "boat_class", label: "艇種" },
  { value: "technique", label: "技術" },
  { value: "rule", label: "ルール" },
  { value: "gear", label: "装備" },
];

interface Props {
  searchParams: Promise<{ category?: string }>;
}

export default async function ReferencePage({ searchParams }: Props) {
  const { category } = await searchParams;
  const activeCategory = category as ReferenceCategory | "all" | undefined;

  const filtered = activeCategory && activeCategory !== "all"
    ? REFERENCES.filter((r) => r.category === activeCategory)
    : REFERENCES;

  const boatClasses = REFERENCES.filter((r) => r.category === "boat_class");
  const techniques = REFERENCES.filter((r) => r.category === "technique");
  const rules = REFERENCES.filter((r) => r.category === "rule");

  return (
    <div className="container">
      {/* ページヘッダー */}
      <div className="ref-page-header">
        <div>
          <h1 className="ref-page-title">Reference</h1>
          <p className="ref-page-sub">
            ヨット競技の用語・技術・艇種の定義集。{REFERENCES.length}件収録。
          </p>
        </div>
        <div className="ref-page-stats">
          <span className="ref-stat-pill">{boatClasses.length} 艇種</span>
          <span className="ref-stat-pill">{techniques.length} 技術用語</span>
          <span className="ref-stat-pill">{rules.length} ルール</span>
        </div>
      </div>

      {/* カテゴリフィルター */}
      <div className="ref-filter-row">
        {CATEGORIES.map((c) => (
          <a
            key={c.value}
            href={c.value === "all" ? "/reference" : `/reference?category=${c.value}`}
            className={`ref-filter-chip ${(!activeCategory || activeCategory === "all") && c.value === "all" ? "active" : activeCategory === c.value ? "active" : ""}`}
          >
            {c.label}
          </a>
        ))}
      </div>

      {/* カード一覧 */}
      {(!activeCategory || activeCategory === "all") ? (
        <>
          <div className="ref-section">
            <h2 className="ref-section-title">
              <span className="ref-section-dot" data-category="boat_class" />
              艇種
            </h2>
            <div className="ref-grid">
              {boatClasses.map((r) => <ReferenceCard key={r.slug} entry={r} />)}
            </div>
          </div>

          {techniques.length > 0 && (
            <div className="ref-section">
              <h2 className="ref-section-title">
                <span className="ref-section-dot" data-category="technique" />
                技術用語
              </h2>
              <div className="ref-grid">
                {techniques.map((r) => <ReferenceCard key={r.slug} entry={r} />)}
              </div>
            </div>
          )}

          {rules.length > 0 && (
            <div className="ref-section">
              <h2 className="ref-section-title">
                <span className="ref-section-dot" data-category="rule" />
                ルール
              </h2>
              <div className="ref-grid">
                {rules.map((r) => <ReferenceCard key={r.slug} entry={r} />)}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="ref-grid stagger">
          {filtered.map((r) => <ReferenceCard key={r.slug} entry={r} />)}
        </div>
      )}
    </div>
  );
}
