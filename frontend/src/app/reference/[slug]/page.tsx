import { notFound } from "next/navigation";
import Link from "next/link";
import { getReferenceBySlug, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/mock-references";
import ReferenceSidebar from "@/components/ReferenceSidebar";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ReferenceDetailPage({ params }: Props) {
  const { slug } = await params;
  const entry = getReferenceBySlug(slug);

  if (!entry) notFound();

  return (
    <div className="container">
      <div className="ref-detail-layout">
        {/* メインコンテンツ */}
        <article className="ref-detail-main">
          {/* パンくずリスト */}
          <nav className="ref-breadcrumb">
            <Link href="/reference" className="ref-breadcrumb-link">Reference</Link>
            <span className="ref-breadcrumb-sep">›</span>
            <span className="ref-breadcrumb-current">{entry.title}</span>
          </nav>

          {/* ① 概要セクション */}
          <section id="summary" className="ref-summary-section">
            <div className="ref-detail-meta">
              <span className="ref-badge ref-badge-category" data-category={entry.category}>
                {CATEGORY_LABEL[entry.category]}
              </span>
              <span className="ref-badge ref-badge-level" data-level={entry.level}>
                {LEVEL_LABEL[entry.level]}
              </span>
            </div>

            <h1 className="ref-detail-title">{entry.title}</h1>
            {entry.titleEn && (
              <p className="ref-detail-title-en">{entry.titleEn}</p>
            )}

            <div className="ref-summary-box">
              <p className="ref-summary-text">{entry.summary}</p>
            </div>
          </section>

          {/* ② 詳細解説セクション */}
          <section id="detail" className="ref-detail-section">
            <div
              className="markdown-body ref-markdown"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.body) }}
            />
          </section>

          {/* ③ 関連リンクセクション */}
          <section id="related" className="ref-links-section">
            <h2 className="ref-links-title">関連するコンテンツを探す</h2>
            <div className="ref-links-grid">
              <Link
                href={`/articles?boatType=${entry.slug}`}
                className="ref-link-card"
              >
                <span className="ref-link-icon">▲</span>
                <span className="ref-link-label">「{entry.title}」の記事を見る</span>
                <span className="ref-link-arrow">→</span>
              </Link>
              <Link
                href={`/questions?boatType=${entry.slug}`}
                className="ref-link-card"
              >
                <span className="ref-link-icon">?</span>
                <span className="ref-link-label">「{entry.title}」のQ&amp;Aを見る</span>
                <span className="ref-link-arrow">→</span>
              </Link>
            </div>
          </section>
        </article>

        {/* 右カラム */}
        <ReferenceSidebar entry={entry} />
      </div>
    </div>
  );
}

// 簡易Markdownレンダラー（見出し・太字・表・リスト・段落）
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // 見出し
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // 太字
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // 表（シンプルな変換）
    .replace(/^\|(.+)\|$/gm, (line) => {
      if (/^[\s|:-]+$/.test(line)) return "";
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      return "<tr>" + cells.map((c) => `<td>${c}</td>`).join("") + "</tr>";
    })
    // リスト
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`)
    // 段落
    .replace(/\n\n([^<])/g, "\n\n<p>$1")
    .replace(/([^>])\n\n/g, "$1</p>\n\n")
    // 表をtableタグでラップ
    .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, (block) => `<table>${block}</table>`);
}

export async function generateStaticParams() {
  const { REFERENCES } = await import("@/lib/mock-references");
  return REFERENCES.map((r) => ({ slug: r.slug }));
}
