import Link from "next/link";
import { ReferenceEntry, getRelatedReferences } from "@/lib/mock-references";

interface Props {
  entry: ReferenceEntry;
}

export default function ReferenceSidebar({ entry }: Props) {
  const related = getRelatedReferences(entry.relatedSlugs);

  return (
    <aside className="ref-detail-sidebar">
      {/* 目次（本文のh2を静的に列挙） */}
      <div className="ref-sidebar-module">
        <h3 className="ref-sidebar-title">目次</h3>
        <ul className="ref-toc-list">
          <li><a href="#summary" className="ref-toc-link">概要</a></li>
          <li><a href="#detail" className="ref-toc-link">詳細解説</a></li>
          <li><a href="#related" className="ref-toc-link">関連リンク</a></li>
        </ul>
      </div>

      {/* 関連Reference */}
      {related.length > 0 && (
        <div className="ref-sidebar-module">
          <h3 className="ref-sidebar-title">関連する用語</h3>
          <ul className="ref-related-list">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/reference/${r.slug}`} className="ref-related-item">
                  <span className="ref-related-dot" data-category={r.category} />
                  <span>{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 編集を提案（将来的な拡張用プレースホルダー） */}
      <div className="ref-sidebar-module ref-sidebar-contribute">
        <p className="ref-contribute-text">
          この説明に誤りや補足がある場合は、Q&amp;Aで質問・議論できます。
        </p>
        <Link href="/questions/new" className="btn btn-ghost" style={{ fontSize: "0.82rem", padding: "0.45rem 0.9rem" }}>
          Q&amp;A で質問する
        </Link>
      </div>
    </aside>
  );
}
