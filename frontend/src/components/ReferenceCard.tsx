import Link from "next/link";
import { ReferenceEntry, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/mock-references";

interface Props {
  entry: ReferenceEntry;
}

export default function ReferenceCard({ entry }: Props) {
  return (
    <Link href={`/reference/${entry.slug}`} className="ref-card" data-category={entry.category}>
      <div className="ref-card-body">
        <div className="ref-card-meta">
          <span className="ref-badge ref-badge-category" data-category={entry.category}>
            {CATEGORY_LABEL[entry.category]}
          </span>
          <span className="ref-badge ref-badge-level" data-level={entry.level}>
            {LEVEL_LABEL[entry.level]}
          </span>
        </div>
        <h3 className="ref-card-title">{entry.title}</h3>
        {entry.titleEn && (
          <p className="ref-card-title-en">{entry.titleEn}</p>
        )}
        <p className="ref-card-summary">{entry.summary}</p>
      </div>
    </Link>
  );
}
