// m-05修正（2026-07-27, REVIEW-backend-2.md）: POST /api/auth/register は「存在すること」しか
// 見ておらず、①51文字以上のusername→Prisma P2000→グローバルハンドラで500（本来400） ②emailの
// 形式検証なし（"a"でも登録できる） ③passwordの長さ下限なし（M-04の総当たり対策と組み合わせても
// 弱いパスワードは無制限に試せる） ④username/emailに数値やオブジェクトを渡すとPrisma例外→500、
// という穴があった。既存の validateTrackPayload/validateAnnotationPayload/validatePublishPayload と
// 同じ形（{ok:true} | {ok:false,status,error}）で揃える。
//
// 基準の根拠:
// - username: schema.prisma上の上限(VarChar(50))を超えたらPrisma例外になるためAPI側で先に400にする。
//   下限3文字はUX的に最低限の識別性を確保するため。文字種は英数字・アンダースコア・ハイフンのみに
//   絞る（表示名ではなくURLやログにも出るIDとして扱われるため、記号を許すとインジェクション面や
//   表示崩れの余地が増える。既存テストのusername（`u${tag}-${timestamp}-${random}`.slice(0,30)）は
//   すべてこの文字種に収まる）。
// - email: 簡易な形式チェック（"@"を含み、ローカル部・ドメイン部がある）に留める。RFC完全準拠の
//   正規表現は複雑さの割に得るものが薄く、既存テストのメールアドレス形式を壊さない範囲で
//   「"a"のような明らかに不正な値」を弾ければ十分という判断。長さはschema上の上限(VarChar(255))。
// - password: bcryptはcost 12で1回数百msかかるため、下限を設けないと弱いパスワードが総当たりの
//   コストを実質下げる（M-04のレート制限と多重防御の関係）。下限8文字はよくある最低ライン。
//   上限は明示していないbcryptの実装依存の挙動（72バイト超は切り詰められる）を悪用した
//   極端に長い入力でのハッシュ計算コスト増大を避けるため200文字に制限する
//   （既存テストの"password123"は11文字で問題なく通る）。

export interface RegisterPayloadInput {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}

export type ValidationResult = { ok: true } | { ok: false; status: 400; error: string };

const USERNAME_MIN = 3;
const USERNAME_MAX = 50; // schema.prisma: username VarChar(50)
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const EMAIL_MAX = 255; // schema.prisma: email VarChar(255)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 200;

export function validateRegisterPayload(input: RegisterPayloadInput): ValidationResult {
  const { username, email, password } = input;

  if (typeof username !== "string") {
    return { ok: false, status: 400, error: "username は文字列である必要があります" };
  }
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return {
      ok: false,
      status: 400,
      error: `username は${USERNAME_MIN}〜${USERNAME_MAX}文字である必要があります`,
    };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      status: 400,
      error: "username は半角英数字・アンダースコア・ハイフンのみ使用できます",
    };
  }

  if (typeof email !== "string") {
    return { ok: false, status: 400, error: "email は文字列である必要があります" };
  }
  if (email.length > EMAIL_MAX) {
    return { ok: false, status: 400, error: `email は${EMAIL_MAX}文字以内である必要があります` };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, status: 400, error: "email の形式が不正です" };
  }

  if (typeof password !== "string") {
    return { ok: false, status: 400, error: "password は文字列である必要があります" };
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return {
      ok: false,
      status: 400,
      error: `password は${PASSWORD_MIN}〜${PASSWORD_MAX}文字である必要があります`,
    };
  }

  return { ok: true };
}
