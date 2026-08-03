// SPEC-home-static.md §5 lib/home.ts: 公開ホームの表示データの正本。
// コンポーネントから分離し、テスト（T-b/T-c）で内容と実在素材を固定する。
// ここに書くのは定数のみ。API呼び出し・副作用は一切含めない（SPEC §1.3 API非依存要件）。

// オーナー裁定（2026-08-02）: ログイン済みでも `/` に `?preview=1` が付いていれば
// 公開ホームを見られるようにする（既定のリダイレクトは維持。§4.1の裁定は変えない）。
// DOM非依存の純関数として切り出す理由: frontendにReact Testing Libraryが無く
// 新規npm依存の追加はAGENTS.md制約1で禁止されているため、Vitestの純関数テストで
// 検証できる形にする必要がある。
export const HOME_PREVIEW_PARAM = "preview";

export function shouldRedirectToSessions(loggedIn: boolean, previewParam: string | null): boolean {
  if (!loggedIn) return false;
  if (previewParam === "1") return false;
  return true;
}

export interface HeroPoster {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface HomeFeature {
  title: string;
  description: string;
  image: string;
  alt: string;
  width: number;
  height: number;
}

// Issue #35: ログイン不要で見られる合成データのデモセッション。値は
// backend/src/lib/demoData.ts の DEMO_PUBLIC_SLUG と一致させること（投入スクリプトが発行するslug）。
export const DEMO_SESSION_SLUG = "sailvlog-demo";

// DEMO-ASSETS.md: 公開ビュー`/p/[slug]`を未ログイン状態で撮影した、ホームのヒーロー専用素材。
export const HERO_POSTER: HeroPoster = {
  src: "/screenshots/hero-public-replay.jpg",
  alt: "未ログイン状態の公開ビューで、複数艇の航跡が同時に描かれているリプレイ画面",
  width: 1033,
  height: 706,
};

// SPEC §3 HS-3: 機能一覧4カード。画像割当は SPEC §3 の「HS-3 の画像割当注」に従う。
export const HOME_FEATURES: HomeFeature[] = [
  {
    title: "リプレイ",
    description: "複数艇のGPXを同時に再生し、色分けと常時ラベルで各艇の動きを追える。",
    image: "/screenshots/replay-hero-desktop.jpg",
    alt: "複数艇が色分けされた航跡を描きながら同時に再生されているリプレイ画面",
    width: 1440,
    height: 720,
  },
  {
    title: "GPX取込",
    description: "複数のGPXファイルをまとめてアップロードし、艇ラベルを自由に編集できる。",
    image: "/screenshots/gpx-import-desktop.jpg",
    alt: "複数のGPXファイルを選択し艇ラベルを編集しているGPX取込画面",
    width: 1440,
    height: 720,
  },
  {
    title: "注釈",
    description: "リプレイのタイムライン上に、モーダルを開かずその場で反省メモを残せる。",
    image: "/screenshots/replay-annotated-desktop.jpg",
    alt: "タイムライン上に反省メモのピンが表示されたリプレイ画面",
    width: 1440,
    height: 720,
  },
  {
    title: "公開共有",
    description: "リンクを知っている人だけが、ログインなしで読み取り専用のリプレイを見られる。",
    image: "/screenshots/public-view-desktop.jpg",
    alt: "未ログイン状態で表示されている公開ビュー画面",
    width: 1440,
    height: 720,
  },
];
