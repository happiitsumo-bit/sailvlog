import type { GlossaryTerm } from "@/lib/glossary";

interface Props {
  term: GlossaryTerm;
  index: number;
}

export default function GlossaryAccordion({ term, index }: Props) {
  return (
    <section id={term.id} className="glossary-card">
      <header className="glossary-card-head">
        <div className="glossary-card-num" aria-hidden>
          {String(index + 1).padStart(2, "0")}
        </div>
        <div className="glossary-card-titles">
          <h2 className="glossary-card-title">{term.label}</h2>
          {term.labelEn && (
            <p className="glossary-card-title-en">{term.labelEn}</p>
          )}
        </div>
      </header>

      <p className="glossary-card-oneliner">{term.oneLiner}</p>

      <details className="glossary-card-details">
        <summary className="glossary-card-toggle">
          <span className="glossary-card-toggle-label-closed">もう少し詳しく</span>
          <span className="glossary-card-toggle-label-open">閉じる</span>
          <span className="glossary-card-toggle-arrow" aria-hidden>▾</span>
        </summary>

        <div id={`${term.id}-detail`} className="glossary-card-detail">
          <div className="glossary-block">
            <h3 className="glossary-block-title">何を見て判断するか</h3>
            <ul className="glossary-list">
              {term.observe.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>

          <div className="glossary-block glossary-block-excess">
            <h3 className="glossary-block-title">過剰／受けすぎのサイン</h3>
            <ul className="glossary-list">
              {term.whenExcess.signs.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <p className="glossary-block-action">
              <span className="glossary-block-action-label">→ どう動かす：</span>
              {term.whenExcess.action}
            </p>
          </div>

          <div className="glossary-block glossary-block-lack">
            <h3 className="glossary-block-title">不足／逃がしすぎのサイン</h3>
            <ul className="glossary-list">
              {term.whenLack.signs.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            <p className="glossary-block-action">
              <span className="glossary-block-action-label">→ どう動かす：</span>
              {term.whenLack.action}
            </p>
          </div>

          <div className="glossary-block">
            <h3 className="glossary-block-title">動かすコントロール</h3>
            <div className="glossary-chips">
              {term.controlledBy.map((c, i) => (
                <span key={i} className="glossary-chip">{c}</span>
              ))}
            </div>
          </div>

          <div className="glossary-block glossary-block-judgement">
            <h3 className="glossary-block-title">タクミの判断手順</h3>
            <ol className="glossary-steps">
              {term.judgement.map((j, i) => (
                <li key={i}>{j}</li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </section>
  );
}
