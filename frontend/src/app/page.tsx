// SPEC-home-static.md rev.2 §3(HS-1) / 縦切り第1スライス: 公開ホーム。
// v3ピボット（2026-07-25, T-26）時点の「振り分けだけの無人の玄関」を廃し、
// 未ログインの部外者に「これは何のプロダクトか」を伝える静的な公開ホームへ全面置換する。
//
// 設計上の絶対要件（SPEC §1.3）: このページは実行時にバックエンドAPIを1回も叩かない。
// サーバコンポーネント（クライアント指定なし）とし、ログイン判定（localStorage）だけを
// 小さなクライアントコンポーネント HomeRedirect に閉じ込める（静的な骨格＋動的な小島）。
//
// 今回のスコープ（縦切り第1スライス）: ヒーローは動くデモリプレイではなく静止画ポスター
// （hero-public-replay.jpg）のみ。動くヒーロー（HS-2）とブログ（HS-9/HS-10）は次スライス。
import Link from "next/link";
import HomeRedirect from "@/components/home/HomeRedirect";
import { HERO_POSTER, HOME_FEATURES } from "@/lib/home";

const GITHUB_URL = "https://github.com/happiitsumo-bit/sailvlog";

export default function HomePage() {
  return (
    <>
      <HomeRedirect />

      <section className="home-hero">
        <div className="home-hero-inner">
          <p className="home-hero-eyebrow">sailvlog</p>
          <h1 className="home-hero-title">大学ヨット部の反省会のための、複数艇GPXリプレイ・デバッガ</h1>
          <p className="home-hero-sub">
            練習・レースのGPXを取り込み、複数艇を同時に再生。タイムライン上に反省メモを残し、
            部外にも読み取り専用でリンク共有できる。
          </p>
          <img
            className="home-hero-image"
            src={HERO_POSTER.src}
            alt={HERO_POSTER.alt}
            width={HERO_POSTER.width}
            height={HERO_POSTER.height}
            fetchPriority="high"
          />
          <div className="home-hero-cta-group">
            <Link href="/login" className="btn btn-primary">
              ログイン
            </Link>
            <Link href="/handbook" className="btn btn-ghost">
              収録ハンドブックを読む
            </Link>
          </div>
        </div>
      </section>

      <section className="home-features">
        <div className="home-features-inner">
          <h2 className="home-section-title">できること</h2>
          <div className="home-features-grid">
            {HOME_FEATURES.map((feature) => (
              <article className="home-feature-card" key={feature.title}>
                <img
                  className="home-feature-image"
                  src={feature.image}
                  alt={feature.alt}
                  width={feature.width}
                  height={feature.height}
                  loading="lazy"
                  decoding="async"
                />
                <h3 className="home-feature-title">{feature.title}</h3>
                <p className="home-feature-desc">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <a href={GITHUB_URL} className="home-footer-link" target="_blank" rel="noreferrer noopener">
            GitHubリポジトリ
          </a>
          <p className="home-footer-line">大学ヨット部の反省会を、GPXリプレイで少しだけ楽にするツールです。</p>
        </div>
      </footer>
    </>
  );
}
