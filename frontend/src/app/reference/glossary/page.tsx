import Link from "next/link";
import { GLOSSARY } from "@/lib/glossary";
import GlossaryAccordion from "@/components/GlossaryAccordion";

export const metadata = {
  title: "判断の共通言語（Glossary） | sailvlog",
  description:
    "セールトリムの判断を支える 5 つの基礎変数。パワー・ツイスト・ドラフト位置・迎角・海面状態。",
};

export default function GlossaryPage() {
  return (
    <div className="container glossary-container">
      <nav className="ref-breadcrumb">
        <Link href="/reference" className="ref-breadcrumb-link">
          Reference
        </Link>
        <span className="ref-breadcrumb-sep">›</span>
        <span className="ref-breadcrumb-current">判断の共通言語</span>
      </nav>

      <header className="glossary-header">
        <p className="glossary-eyebrow">v2 / 判断の共通言語</p>
        <h1 className="glossary-title">
          まずこの<span className="glossary-title-accent">5語</span>。
        </h1>
        <p className="glossary-lead">
          セールトリムは「その時々で正解が違う」。
          だから sailvlog は固定の答えではなく、
          <strong>「何に合わせて決めるか」の軸</strong>を渡す。
          全てのトリム項目は、ここで定義する 5 つの基礎変数のいずれかに紐づく。
        </p>
      </header>

      <nav className="glossary-anchor-nav" aria-label="目次">
        {GLOSSARY.map((t, i) => (
          <a key={t.id} href={`#${t.id}`} className="glossary-anchor">
            <span className="glossary-anchor-num">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="glossary-anchor-label">{t.label}</span>
          </a>
        ))}
      </nav>

      <div className="glossary-list-wrap">
        {GLOSSARY.map((t, i) => (
          <GlossaryAccordion key={t.id} term={t} index={i} />
        ))}
      </div>

      <footer className="glossary-footer">
        <p className="glossary-footer-text">
          この 5 語は、個別のトリム項目（バング・カニンガム・トラベラー…）の
          <strong>③ 適合の軸</strong>がすべて参照する共通言語。
          項目を読むたびに、この 5 語の理解が強化されていく。
        </p>
        <Link href="/reference" className="glossary-footer-link">
          ← Reference 一覧に戻る
        </Link>
      </footer>
    </div>
  );
}
