export type ReferenceCategory = "boat_class" | "technique" | "rule" | "gear";
export type ReferenceLevel = "beginner" | "intermediate" | "advanced";

export interface ReferenceEntry {
  slug: string;
  title: string;
  titleEn?: string;
  category: ReferenceCategory;
  level: ReferenceLevel;
  summary: string;
  body: string;
  relatedSlugs: string[];
}

export const REFERENCES: ReferenceEntry[] = [
  // ===== 艇種 =====
  {
    slug: "470",
    title: "470",
    titleEn: "470 Class",
    category: "boat_class",
    level: "intermediate",
    summary: "全長4.70mの2人乗りスキフ。オリンピック正式種目であり、国内最多の競技人口を持つ代表的なレーシングディンギー。",
    body: `## 概要

470（よんなな）は全長4.70mの2人乗りディンギーヨットです。スキッパー（舵取り）とクルー（前甲板担当）の2名で競技します。

## 特徴

- **スピネーカー搭載**: ダウンウィンドでスピネーカーを展開し、高い下り帆走速度を実現
- **スライディングシート（ハイク）**: クルーはワイヤーにぶら下がりながら艇を起こす
- **国際クラス**: 世界70カ国以上で普及しており、国際セーリング連盟（World Sailing）が管理

## オリンピックでの歴史

1976年モントリオール大会から採用。男女別クラスとして長く五輪種目であったが、2024年パリ大会からは混合クラスに変更された。

## セッティングの基本

| 項目 | 微風 | 強風 |
|------|------|------|
| マストレーク | 後退気味 | 前傾 |
| ダウンホール | ゆるめ | 引き込み |
| アウトホール | ゆるめ | 引き込み |
| バックステイ | ゆるめ | 引き込み |
`,
    relatedSlugs: ["ilca", "49er", "close-hauled", "spinnaker", "hiking"],
  },
  {
    slug: "ilca",
    title: "ILCA（旧Laser）",
    titleEn: "ILCA / Laser",
    category: "boat_class",
    level: "intermediate",
    summary: "全世界で最も普及したシングルハンドディンギー。旧称「レーザー」として知られ、オリンピック種目。艇体は世界共通規格。",
    body: `## 概要

ILCA（International Laser Class Association）は、旧来「Laser（レーザー）」の名称で親しまれてきた1人乗りディンギーです。

## セイルサイズの種類

| 種別 | セイル面積 | 対象 |
|------|-----------|------|
| ILCA 4 | 4.7㎡ | ジュニア・女性 |
| ILCA 6 | 5.76㎡ | 女性・軽量選手 |
| ILCA 7 | 7.06㎡ | 成人男性標準 |

## 特徴

- **艇体の均一性**: 世界中で同一規格のハルを使用するため、セーラーの技術差がそのまま結果に現れる
- **シングルハンド**: 1人でセッティングから操船まで行うため、自立したセーリング技術が身に付く
`,
    relatedSlugs: ["470", "close-hauled", "downhaul", "outhaul"],
  },
  {
    slug: "snipe",
    title: "Snipe",
    titleEn: "Snipe Class",
    category: "boat_class",
    level: "intermediate",
    summary: "全長4.72mの2人乗りディンギー。1931年に設計された歴史ある艇種で、国内では学生ヨットで広く使われる。",
    body: `## 概要

Snipe（スナイプ）は1931年にWilliam F. Crosby氏が設計した2人乗りディンギーです。現在も世界各国でワンデザインクラスとして競技されています。

## 国内での位置づけ

日本の大学ヨット部では最も普及している艇種の一つ。学連（全日本学生ヨット連盟）の公式種目であり、多くの大学が470とスナイプの2艇種体制で活動しています。

## 470との比較

| 項目 | Snipe | 470 |
|------|-------|-----|
| 全長 | 4.72m | 4.70m |
| 乗員 | 2名 | 2名 |
| スピネーカー | なし | あり |
| スライドシート | なし | あり |
| 難易度 | 中級 | 中〜上級 |
`,
    relatedSlugs: ["470", "tacking", "jibing"],
  },
  {
    slug: "49er",
    title: "49er",
    titleEn: "49er Class",
    category: "boat_class",
    level: "advanced",
    summary: "高速スキフの代表格。全長4.99mの2人乗りで、スピネーカーとトラピーズを駆使して驚異的なスピードを実現するオリンピック種目。",
    body: `## 概要

49erはオーストラリアのJulian Bethwaite氏が設計した高性能スキフです。船体の軽さとオーバーセールドな設計により、風速が上がると飛行機のように走る「プレーニング」状態になります。

## 難易度

全ディンギークラスの中でも操船難易度は最高峰の部類。強風下でのワイプアウト（転覆）は日常的で、強靭な体力と反射神経が求められます。

## オリンピック

1996年アトランタ大会から採用。女子版の「49erFX」も2016年リオ大会から追加されました。
`,
    relatedSlugs: ["470", "spinnaker", "planing", "trapeze"],
  },
  {
    slug: "420",
    title: "420",
    titleEn: "420 Class",
    category: "boat_class",
    level: "beginner",
    summary: "全長4.20mの2人乗りジュニアディンギー。470の入門艇として位置づけられ、国内のジュニア・高校生世代の主力艇種。",
    body: `## 概要

420（よんにまる）は全長4.20mの2人乗りディンギーです。470に似た構造を持ちながらやや小型で、ジュニアセーラーの育成に最適な艇種として世界で広く使われています。

## 470への発展性

セッティングや操船の考え方が470と共通しているため、420で習得した技術はそのまま470に応用できます。高校から大学への競技者のスムーズな移行をサポートします。
`,
    relatedSlugs: ["470", "snipe", "close-hauled"],
  },
  {
    slug: "op",
    title: "OP（オプティミスト）",
    titleEn: "Optimist",
    category: "boat_class",
    level: "beginner",
    summary: "全長2.36mの1人乗りジュニア艇。15歳以下を対象とした国際クラスで、世界最多の競技人口を持つヨット入門の定番。",
    body: `## 概要

Optimist（オプティミスト、略称OP）は1947年にアメリカで開発されたジュニア専用ディンギーです。シンプルな構造で安全性が高く、世界中のヨットスクールで最初に乗る艇として使われています。

## ルール

IODA（International Optimist Dinghy Association）が管理するワンデザインクラス。15歳以下のジュニアセーラーのみが公式競技に参加できます。

## 競技人口

世界120カ国以上で普及しており、登録艇数は15万艇以上。最も多くのセーラーが最初に触れる艇種です。
`,
    relatedSlugs: ["420", "close-hauled", "tacking"],
  },

  // ===== 技術用語 =====
  {
    slug: "close-hauled",
    title: "クローズホールド",
    titleEn: "Close-Hauled",
    category: "technique",
    level: "beginner",
    summary: "風に向かって最も鋭角に帆走するポイント。セールを引き込み、艇を可能な限り風上に向けて走る基本帆走点。",
    body: `## 定義

クローズホールドとは、真の風向に対して約30〜45度の角度で風上に向かって帆走する状態です。帆走の「ポイント・オブ・セール（Points of Sail）」の中で最も風上を向いた帆走角度です。

## セールのトリム

- メインセール・ジブともに**最大限に引き込む**
- テルテール（タフト）が両側水平になるよう調整
- バックステイを引いてマストを曲げ、パワーを抜く（強風時）

## 注意点

真風向にはヨットは帆走できない（ノーセールゾーン）。このゾーンに入ると失速するため、常にセールの状態を確認しながら舵を調整する必要があります。

## 関連する概念

- **タッキング**: クローズホールドから反対舷のクローズホールドに切り替える操作
- **ピンチング**: 必要以上に風上を向きすぎて速度が落ちる状態
- **フォーリング・オフ**: 風下に向けて少し落とし、スピードを回復させること
`,
    relatedSlugs: ["tacking", "reaching", "running", "downhaul"],
  },
  {
    slug: "tacking",
    title: "タッキング（タック）",
    titleEn: "Tacking",
    category: "technique",
    level: "beginner",
    summary: "艇首を風上に向けて回し、風を受ける舷（サイド）を切り替える操船動作。クローズホールドで反対タックに移る基本操作。",
    body: `## 定義

タッキングとは、艇首（バウ）を風向に向かって回転させることで、セールに当たる風の側（タック）を切り替える操作です。

## 手順（2人乗り）

1. スキッパーが「タック用意」とコール
2. クルーが「よし」と答えてジブシートの準備
3. スキッパーが「タック」とコールしてティラーを引く
4. 艇が風上を通過する瞬間にクルーがジブシートを切り替え
5. スキッパーがティラーを戻して新しいタックで加速

## タッキングの失敗（スタック）

艇が風上を向いた状態で止まってしまうことを「スタック（in irons）」と言います。風が弱いとき、または速度が不十分なままタックを始めると起きやすい。
`,
    relatedSlugs: ["jibing", "close-hauled", "mark-room"],
  },
  {
    slug: "jibing",
    title: "ジャイビング（ジャイブ）",
    titleEn: "Jibing / Gybing",
    category: "technique",
    level: "intermediate",
    summary: "艇尾（スターン）を風上に向けて回し、風を受ける舷を切り替える操船動作。ランニングから反対タックに移る操作。",
    body: `## 定義

ジャイブとは、艇尾（スターン）が風向を通過するように回転させて、セールのタックを切り替える操作です。タッキングと対をなす基本操作です。

## タッキングとの違い

| 項目 | タッキング | ジャイビング |
|------|-----------|------------|
| 艇首・艇尾 | 艇首が風を向く | 艇尾が風を向く |
| 帆走角度 | クローズ付近 | ランニング付近 |
| セールの動き | ゆっくり移動 | 急激にスイング |
| 危険度 | 低 | 高（ブームが急激に飛ぶ） |

## アンコントロールドジャイブ

意図せずブームが急激に飛ぶ「アンコントロールドジャイブ」はブームが頭部に当たる危険があります。特に強風下では十分な注意が必要です。
`,
    relatedSlugs: ["tacking", "running", "broaching"],
  },
  {
    slug: "downhaul",
    title: "ダウンホール",
    titleEn: "Downhaul / Cunningham",
    category: "technique",
    level: "intermediate",
    summary: "マストに沿ってセールを下方向に引き、セールの腹（カーブ）の位置を前方に調整するコントロール。風が強いほど引き込む。",
    body: `## 定義

ダウンホール（別名カニンガム）は、セールのラフ（前縁）をマストに沿って下方向に引き伸ばすための調整システムです。

## 効果

- 強く引くと → セールのドラフト（腹）の位置が前方に移動、パワーが減少
- 緩めると → ドラフトが後方に移動、パワーが増加

## 風速に応じた調整

| 風速 | ダウンホール | 理由 |
|------|------------|------|
| 微風（〜7knot） | ゆるめ | セールのパワーを最大化 |
| 中風（8〜15knot） | 少し引く | バランス重視 |
| 強風（16knot〜） | しっかり引く | 過パワーを防ぐ |

## ILCAでの重要性

ILCAはダウンホールが最も重要なコントロールの一つ。適切な調整がボートスピードに直結します。
`,
    relatedSlugs: ["outhaul", "backstaystension", "close-hauled", "ilca"],
  },
  {
    slug: "outhaul",
    title: "アウトホール",
    titleEn: "Outhaul",
    category: "technique",
    level: "intermediate",
    summary: "メインセールのクリュー（後下角）をブームの後端方向に引き、セールの横方向の腹を調整するコントロール。",
    body: `## 定義

アウトホールはメインセールのクリュー（後下角）をブームに沿って後方に引くためのライン・システムです。

## 効果

- 引き込むと → セールのフラット化、パワー減少
- 緩めると → セールに腹ができ、パワー増加

## 風速に応じた調整

| 帆走ポイント | 調整 |
|------------|------|
| クローズ・強風 | 引き込む |
| クローズ・微風 | ゆるめる |
| ランニング | ゆるめてフルパワー |
`,
    relatedSlugs: ["downhaul", "close-hauled", "ilca"],
  },
  {
    slug: "mark-room",
    title: "マークルーム",
    titleEn: "Mark Room",
    category: "rule",
    level: "intermediate",
    summary: "レーシングルール（RRS）における権利規定。マークを回航する際に内側の艇が外側の艇に対して要求できる通過のためのスペース。",
    body: `## 定義（RRS 18条）

マークルームとは、Racing Rules of Sailing（RRS）第18条に規定された権利です。マークを回航する際、内側（マーク側）に位置する艇は外側の艇に対してマーク回航に必要なスペースを要求できます。

## 権利が発生する条件

1. 2艇以上がマークのゾーン（半径3艇身以内）に入るとき
2. 内側の艇が外側の艇に「重なっている（overlap）」こと

## 抗議・ペナルティ

マークルームが与えられなかった場合、不利益を受けた艇はプロテスト（抗議）を申し立てることができます。

## 注意

スタートマーク（ポートエンド）には特別なルールが適用されます。RRS 18.3を参照。
`,
    relatedSlugs: ["tacking", "jibing"],
  },
];

export const CATEGORY_LABEL: Record<ReferenceCategory, string> = {
  boat_class: "艇種",
  technique: "技術",
  rule: "ルール",
  gear: "装備",
};

export const LEVEL_LABEL: Record<ReferenceLevel, string> = {
  beginner: "入門",
  intermediate: "中級",
  advanced: "上級",
};

export function getReferenceBySlug(slug: string): ReferenceEntry | undefined {
  return REFERENCES.find((r) => r.slug === slug);
}

export function getRelatedReferences(slugs: string[]): ReferenceEntry[] {
  return slugs.map((s) => REFERENCES.find((r) => r.slug === s)).filter(Boolean) as ReferenceEntry[];
}
