// M-05修正（2026-07-27, REVIEW-backend-2.md）: JWT_SECRETが未設定、または
// docker-compose.yml/.env.exampleに掲載されているプレースホルダ値のまま起動できてしまう問題。
// 起動時にfail-fastで検証し、弱い秘密のまま本番が動くのを防ぐ。
//
// 既知のプレースホルダ（docker-compose.yml・.env.example・.env.test に平文で存在する値。
// このリポジトリが公開されている以上、この文字列自体は秘密ではなく「これが本番に残っていたら
// 誰でもJWTを偽造できる」という検知対象そのもの）。
//
// M3-03修正（2026-07-28, REVIEW-backend-3.md）: M-05はKNOWN_PLACEHOLDERSを
// "change_this_secret_in_production"（.env.example）だけで作り、自分がdocker-compose.yml/
// .env.testに新しく書いた2値（dev-only-jwt-secret-change-me-... / test_secret_do_not_use_in_prod_...）
// をリストに入れ忘れていた。ガードの前提（=リポジトリに平文で存在する値は全部検知する）が
// 自分の手で壊れていた状態だったので、その2値を追加する。
//
// 「リポジトリの平文値を実行時に機械的に拾う」方式は採用しなかった: 本番ビルド(Dockerfile production
// stage)はdist/のみをコピーし、backend直下の.env.test・リポジトリルートのdocker-compose.ymlは
// イメージに含まれない。つまり本番の実行時にそれらのファイルを読んでも「読めない＝何も検知できない」
// だけで、防ぎたい脅威（本番でdocker-compose.ymlの値をコピペする事故）を検知できない。
// 平文値をソースコードに列挙する手動リストのほうが、ビルド後のdistにも確実に残るため実効性がある
// （代わりに「新しいプレースホルダを追加したら、このリストも更新する」運用が必要。今回のM3-03自体が
// その運用が徹底されていなかった証拠なので、コメントで明示しておく）。
const KNOWN_PLACEHOLDERS = new Set([
  "change_this_secret_in_production", // .env.example
  "dev-only-jwt-secret-change-me-1234567890abcdef", // docker-compose.yml（開発用）
  "test_secret_do_not_use_in_prod_1234567890", // backend/.env.test
  "",
]);

// 32文字未満は「テスト用の短い適当な文字列」を弾くための最低ライン
// （crypto.randomBytes(24).toString("hex") で48文字になる想定）。
const MIN_LENGTH = 32;

// M3-03修正: プレースホルダ検知・長さチェックは NODE_ENV === "production" のときだけ厳格化する。
// 理由: .env.test（JWT_SECRET=test_secret_do_not_use_in_prod_1234567890）やdocker-compose.ymlの
// 開発用値は、それ自体が「テスト・開発専用と分かるようにわざとリポジトリに書いた値」であり、
// 本番と同じ強度を要求すると開発・CIのたびに固有の秘密鍵を用意する摩擦が増えるだけで得るものがない。
// 一方、未設定（secretが空/undefined）はどの環境でも許容しない（jwt.sign()が原因不明のエラーで
// 落ちるより、ここで明示的に落ちたほうが復旧しやすいため）。
// この分岐が本番で無効化されないことは、Dockerfileのproduction stageで明示的に
// `ENV NODE_ENV=production` を設定することで保証している（Renderのダッシュボード設定に依存しない）。
export function assertJwtSecretConfigured(
  secret: string | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): void {
  if (!secret) {
    throw new Error(
      "[起動中止] JWT_SECRET が未設定です。\n" +
        "  backend/.env（本番はRenderの環境変数）に強力なランダム文字列を設定してください。\n" +
        "  生成方法: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    );
  }
  if (nodeEnv !== "production") {
    return;
  }
  if (KNOWN_PLACEHOLDERS.has(secret)) {
    throw new Error(
      "[起動中止] JWT_SECRET がリポジトリに公開されている既知のプレースホルダ値のままです。\n" +
        "  この状態で起動すると、誰でも任意のuserIdのJWTを偽造でき、全チームの全データに読み書きできてしまいます。\n" +
        "  backend/.env（本番はRenderの環境変数）に強力なランダム文字列を設定してください。\n" +
        "  生成方法: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    );
  }
  if (secret.length < MIN_LENGTH) {
    throw new Error(
      `[起動中止] JWT_SECRET が短すぎます（${secret.length}文字。最低${MIN_LENGTH}文字必要）。\n` +
        "  生成方法: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    );
  }
}
