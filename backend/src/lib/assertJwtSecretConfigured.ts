// M-05修正（2026-07-27, REVIEW-backend-2.md）: JWT_SECRETが未設定、または
// docker-compose.yml/.env.exampleに掲載されているプレースホルダ値のまま起動できてしまう問題。
// 起動時にfail-fastで検証し、弱い秘密のまま本番が動くのを防ぐ。
//
// 既知のプレースホルダ（docker-compose.yml・.env.example に平文で存在する値。
// このリポジトリが公開されている以上、この文字列自体は秘密ではなく「これが本番に残っていたら
// 誰でもJWTを偽造できる」という検知対象そのもの）。
const KNOWN_PLACEHOLDERS = new Set(["change_this_secret_in_production", ""]);

// 32文字未満は「テスト用の短い適当な文字列」を弾くための最低ライン
// （crypto.randomBytes(24).toString("hex") で48文字になる想定。テスト・開発用の値も
// この閾値を満たすようにbackend/.env.test・docker-compose.ymlを更新済み）。
const MIN_LENGTH = 32;

export function assertJwtSecretConfigured(secret: string | undefined): void {
  if (!secret || KNOWN_PLACEHOLDERS.has(secret)) {
    throw new Error(
      "[起動中止] JWT_SECRET が未設定、またはリポジトリに公開されている既知のプレースホルダ値のままです。\n" +
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
