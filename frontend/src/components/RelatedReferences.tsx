import Link from "next/link";
import { REFERENCES, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/mock-references";

interface Props {
  boatTypeSlug?: string;
  tagSlugs?: string[];
}

export default function RelatedReferences({ boatTypeSlug, tagSlugs = [] }: Props) {
  const matched = REFERENCES.filter((r) => {
    if (boatTypeSlug && r.slug === boatTypeSlug) return true;
    if (tagSlugs.some((t) => r.slug === t || r.relatedSlugs.includes(t))) return true;
    return false;
  }).slice(0, 4);

  if (matched.length === 0) return null;

  return (
    <div className="sidebar-section">
      <p className="sidebar-title">関連 Reference</p>
      <ul className="ref-related-list">
        {matched.map((r) => (
          <li key={r.slug}>
            <Link href={`/reference/${r.slug}`} className="ref-related-item">
              <span className="ref-related-dot" data-category={r.category} />
              <span className="ref-related-body">
                <span className="ref-related-title">{r.title}</span>
                <span className="ref-related-meta">
                  {CATEGORY_LABEL[r.category]}・{LEVEL_LABEL[r.level]}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/reference" className="ref-sidebar-more">
        Reference一覧 →
      </Link>
    </div>
  );
}
