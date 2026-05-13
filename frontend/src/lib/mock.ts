// ===========================================================
// Mock data for sailvlog frontend redesign (Phase: frontend-only)
// バックエンドが未対応の新機能 (Q&A / Feed / Learn / Sailors) を
// ダミーデータで動かすためのファイル。
// ===========================================================

export type MockSailor = {
  id: number;
  username: string;
  displayName: string;
  avatarColor: string;
  boatType: string;
  experienceYears: number;
  affiliation: string;
  specialty: string;
  bio: string;
  stats: { articles: number; questions: number; followers: number };
};

export type MockQuestion = {
  id: number;
  title: string;
  body: string;
  author: MockSailor;
  boatType: string;
  tags: string[];
  createdAt: string;
  answerCount: number;
  voteCount: number;
  hasAcceptedAnswer: boolean;
  views: number;
};

export type MockAnswer = {
  id: number;
  questionId: number;
  body: string;
  author: MockSailor;
  createdAt: string;
  voteCount: number;
  isAccepted: boolean;
};

export type MockPost = {
  id: number;
  author: MockSailor;
  body: string;
  createdAt: string;
  likeCount: number;
  replyCount: number;
};

export type MockCourse = {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  boatType: string;
  lessonCount: number;
  estimatedHours: number;
  enrolledCount: number;
  accentColor: string;
  description: string;
  lessons: { id: number; title: string; minutes: number }[];
};

// ----- セーラー -----
export const mockSailors: MockSailor[] = [
  {
    id: 1,
    username: "tatsuya",
    displayName: "Tatsuya Mori",
    avatarColor: "#ff3d00",
    boatType: "470",
    experienceYears: 8,
    affiliation: "Waseda Univ. Sailing Club",
    specialty: "Sail trim / Tactics",
    bio: "470級ヘルムスマン。全日本インカレ準優勝経験あり。スピードと判断力で勝つセーリングを追求中。",
    stats: { articles: 23, questions: 12, followers: 412 },
  },
  {
    id: 2,
    username: "yuki",
    displayName: "Yuki Tanaka",
    avatarColor: "#00d9ff",
    boatType: "ILCA",
    experienceYears: 12,
    affiliation: "JSAF Strong Team",
    specialty: "Wind reading / Heavy weather",
    bio: "ILCA 6/7。世界選手権出場経験あり。風の読み方とフィジカルトレーニングが専門。",
    stats: { articles: 41, questions: 8, followers: 1208 },
  },
  {
    id: 3,
    username: "haruki",
    displayName: "Haruki Sato",
    avatarColor: "#c4ff00",
    boatType: "Snipe",
    experienceYears: 5,
    affiliation: "Keio Univ. Sailing Club",
    specialty: "Boat handling / Crew work",
    bio: "スナイプ級クルー。大学からセーリングを始めて4年。練習記録を毎週書いています。",
    stats: { articles: 17, questions: 25, followers: 198 },
  },
  {
    id: 4,
    username: "rina",
    displayName: "Rina Kobayashi",
    avatarColor: "#ff3d00",
    boatType: "49er",
    experienceYears: 6,
    affiliation: "Olympic Development Squad",
    specialty: "Trapeze / Downwind speed",
    bio: "49er女子。スキフ艇のスピードと安定性の両立を研究中。",
    stats: { articles: 31, questions: 6, followers: 845 },
  },
  {
    id: 5,
    username: "ken",
    displayName: "Ken Yamazaki",
    avatarColor: "#00d9ff",
    boatType: "Cruiser",
    experienceYears: 20,
    affiliation: "Hayama Yacht Club",
    specialty: "Offshore navigation / Weather routing",
    bio: "クルーザー乗り20年。外洋レース・回航・天気図の読み方を主に書きます。",
    stats: { articles: 56, questions: 4, followers: 2103 },
  },
  {
    id: 6,
    username: "mio",
    displayName: "Mio Hashimoto",
    avatarColor: "#c4ff00",
    boatType: "470",
    experienceYears: 3,
    affiliation: "Kyoto Univ. Sailing Club",
    specialty: "Beginner training",
    bio: "470始めて3年。初心者目線の記事を書きます。",
    stats: { articles: 12, questions: 18, followers: 156 },
  },
];

// ----- Q&A -----
export const mockQuestions: MockQuestion[] = [
  {
    id: 1,
    title: "強風時の470でジブシートのテンションをどこまで上げるべきか?",
    body: "15ノット以上の強風レースでアッパーセクションがオープンしすぎる感じがあります。ジブシートを引きすぎるとヒールが大きくなり、緩めるとパワーが逃げる。最適なバランスの探り方を教えてください。",
    author: mockSailors[5],
    boatType: "470",
    tags: ["sail-trim", "heavy-weather", "race-strategy"],
    createdAt: "2026-05-11T08:30:00Z",
    answerCount: 4,
    voteCount: 12,
    hasAcceptedAnswer: true,
    views: 284,
  },
  {
    id: 2,
    title: "ILCAでのスタートライン取り、ピンエンド有利の判断基準は?",
    body: "スタート前のラインバイアスチェックで悩んでいます。コンパスでの計測手順と、風の振れ込みを考慮した判断の組み立て方を知りたいです。",
    author: mockSailors[2],
    boatType: "ILCA",
    tags: ["start", "race-strategy", "wind-reading"],
    createdAt: "2026-05-10T14:12:00Z",
    answerCount: 3,
    voteCount: 8,
    hasAcceptedAnswer: false,
    views: 156,
  },
  {
    id: 3,
    title: "49erのギブ時、トラピーズハーネスのフックタイミング",
    body: "ギブ後の立ち上がりが遅く、加速までに時間がかかります。フックイン/アウトの順序と上半身の動きについてアドバイスをお願いします。",
    author: mockSailors[3],
    boatType: "49er",
    tags: ["trapeze", "downwind", "boat-handling"],
    createdAt: "2026-05-09T19:45:00Z",
    answerCount: 2,
    voteCount: 15,
    hasAcceptedAnswer: true,
    views: 421,
  },
  {
    id: 4,
    title: "外洋レースでのワッチ交代、最適な時間配分は?",
    body: "24時間以上のオフショアレースでクルー4名のワッチ体制を組むのですが、疲労管理と判断力維持のバランスが難しいです。",
    author: mockSailors[4],
    boatType: "Cruiser",
    tags: ["offshore", "navigation", "crew-management"],
    createdAt: "2026-05-08T11:20:00Z",
    answerCount: 6,
    voteCount: 22,
    hasAcceptedAnswer: true,
    views: 698,
  },
  {
    id: 5,
    title: "セーリング前の体幹トレ、推奨メニュー教えてください",
    body: "シーズン前の3ヶ月で集中的に体幹を鍛えたいです。ヨットに特化したメニューがあれば紹介してください。",
    author: mockSailors[5],
    boatType: "470",
    tags: ["physical", "training", "off-season"],
    createdAt: "2026-05-07T07:00:00Z",
    answerCount: 5,
    voteCount: 18,
    hasAcceptedAnswer: false,
    views: 512,
  },
];

export const mockAnswers: MockAnswer[] = [
  {
    id: 1,
    questionId: 1,
    body: "15ノットを超えたらジブシートはトラベラーを下げてシートテンションを保つのが基本です。アッパーリーチがオープンしすぎる場合はジブハリヤードを上げてドラフトを前に持ってくると改善します。バックステイテンションとセットで考えると分かりやすいですよ。",
    author: mockSailors[0],
    createdAt: "2026-05-11T10:15:00Z",
    voteCount: 18,
    isAccepted: true,
  },
  {
    id: 2,
    questionId: 1,
    body: "うちのチームは強風時 ジブカニンガム→バックステイ→ジブシート の順で調整してます。シート単体で答えを出さない、というのがポイント。",
    author: mockSailors[1],
    createdAt: "2026-05-11T11:30:00Z",
    voteCount: 7,
    isAccepted: false,
  },
];

// ----- タイムライン (Feed) -----
export const mockPosts: MockPost[] = [
  {
    id: 1,
    author: mockSailors[0],
    body: "今日の油壷、北東12ノット。470でのアッパー走り、ジブカニンガムを少し緩めただけでスピード乗ったの面白い。一個一個の調整が結果に出るのがいい。",
    createdAt: "2026-05-12T09:30:00Z",
    likeCount: 24,
    replyCount: 3,
  },
  {
    id: 2,
    author: mockSailors[1],
    body: "ILCAの体幹トレ、デッドリフトより片足ブリッジの方がヨットの体勢には効く気がする。皆さんどうしてますか?",
    createdAt: "2026-05-12T08:12:00Z",
    likeCount: 41,
    replyCount: 12,
  },
  {
    id: 3,
    author: mockSailors[4],
    body: "明後日からの相模湾レース、低気圧が南岸通るルートで読みづらい。GFSとECMWFで予報がだいぶ違うので両方見ながら戦略組み立てる。",
    createdAt: "2026-05-12T07:45:00Z",
    likeCount: 67,
    replyCount: 8,
  },
  {
    id: 4,
    author: mockSailors[3],
    body: "49erのジブのリードブロックを後ろに2目盛り動かしたら、フェッチで0.2ノット稼げた。微調整侮れない。",
    createdAt: "2026-05-11T22:18:00Z",
    likeCount: 52,
    replyCount: 5,
  },
  {
    id: 5,
    author: mockSailors[2],
    body: "今日は強風練習で4回沈。でも復帰タイム前回より15秒速くなった。沈は学び。",
    createdAt: "2026-05-11T18:30:00Z",
    likeCount: 89,
    replyCount: 14,
  },
  {
    id: 6,
    author: mockSailors[5],
    body: "初心者向けの記事書き始めました。「最初に覚えるべき5つのロープワーク」。コメントで追加してほしい結びあれば教えてください!",
    createdAt: "2026-05-11T14:05:00Z",
    likeCount: 38,
    replyCount: 9,
  },
];

// ----- 学習コース -----
export const mockCourses: MockCourse[] = [
  {
    id: 1,
    slug: "470-foundations",
    title: "470 FOUNDATIONS",
    subtitle: "470級の基礎から大会出場まで",
    level: "BEGINNER",
    boatType: "470",
    lessonCount: 12,
    estimatedHours: 8,
    enrolledCount: 342,
    accentColor: "#ff3d00",
    description: "470級を始める人のための12レッスンコース。艤装・基本操作・タッキング・ジャイビングからレース出場の準備までを体系的に学べます。",
    lessons: [
      { id: 1, title: "艇の各部名称と艤装", minutes: 25 },
      { id: 2, title: "セールセッティングの基本", minutes: 30 },
      { id: 3, title: "出艇前のチェックリスト", minutes: 20 },
      { id: 4, title: "ハイクアウトとボディポジション", minutes: 35 },
      { id: 5, title: "タッキングの分解動作", minutes: 40 },
      { id: 6, title: "ジャイビングの安全な手順", minutes: 40 },
      { id: 7, title: "上マークアプローチ", minutes: 30 },
      { id: 8, title: "ダウンウィンドの基本", minutes: 35 },
      { id: 9, title: "風の見方入門", minutes: 30 },
      { id: 10, title: "初めてのレース", minutes: 45 },
      { id: 11, title: "沈と復帰", minutes: 25 },
      { id: 12, title: "練習メニューの組み立て方", minutes: 30 },
    ],
  },
  {
    id: 2,
    slug: "race-tactics-intermediate",
    title: "RACE TACTICS",
    subtitle: "レース戦術 中級コース",
    level: "INTERMEDIATE",
    boatType: "ALL",
    lessonCount: 10,
    estimatedHours: 6,
    enrolledCount: 218,
    accentColor: "#00d9ff",
    description: "スタートからフィニッシュまで、各レグの判断力を磨く戦術コース。470/ILCA/Snipe など艇種横断で学べます。",
    lessons: [
      { id: 1, title: "スタートライン分析", minutes: 35 },
      { id: 2, title: "風の振れと永続シフト", minutes: 40 },
      { id: 3, title: "コース選択の意思決定", minutes: 35 },
      { id: 4, title: "上マーク回航のレーン取り", minutes: 30 },
      { id: 5, title: "リーチングレッグの戦術", minutes: 30 },
      { id: 6, title: "ダウンウィンドのジャイブ判断", minutes: 35 },
      { id: 7, title: "他艇との位置取り", minutes: 30 },
      { id: 8, title: "規則と抗議", minutes: 40 },
      { id: 9, title: "シリーズ戦の戦略", minutes: 30 },
      { id: 10, title: "メンタル管理", minutes: 25 },
    ],
  },
  {
    id: 3,
    slug: "offshore-navigation",
    title: "OFFSHORE NAVIGATION",
    subtitle: "外洋航海と天気図の読み方",
    level: "ADVANCED",
    boatType: "Cruiser",
    lessonCount: 8,
    estimatedHours: 10,
    enrolledCount: 96,
    accentColor: "#c4ff00",
    description: "外洋セーリングのナビゲーションとウェザールーティングを深く学ぶ上級コース。GRIBデータの読み方から実戦での意思決定まで。",
    lessons: [
      { id: 1, title: "海図と海図記号", minutes: 60 },
      { id: 2, title: "潮汐・潮流の読み方", minutes: 50 },
      { id: 3, title: "GPSとプロッターの活用", minutes: 45 },
      { id: 4, title: "天気図の基礎", minutes: 60 },
      { id: 5, title: "GRIBデータとルーティング", minutes: 70 },
      { id: 6, title: "ワッチ体制の組み立て", minutes: 40 },
      { id: 7, title: "緊急時の判断", minutes: 55 },
      { id: 8, title: "回航計画の立て方", minutes: 60 },
    ],
  },
  {
    id: 4,
    slug: "ilca-speed",
    title: "ILCA SPEED LAB",
    subtitle: "ILCAのスピード追求",
    level: "INTERMEDIATE",
    boatType: "ILCA",
    lessonCount: 9,
    estimatedHours: 5,
    enrolledCount: 178,
    accentColor: "#ff3d00",
    description: "ILCA級のスピード向上に特化したコース。セッティング、ボディムーブ、波対応を徹底解説。",
    lessons: [
      { id: 1, title: "アウトホールとカニンガム", minutes: 30 },
      { id: 2, title: "バングテンションの極意", minutes: 35 },
      { id: 3, title: "アップウィンドのボディムーブ", minutes: 40 },
      { id: 4, title: "波への当て方", minutes: 35 },
      { id: 5, title: "ダウンウィンドのパンピング", minutes: 30 },
      { id: 6, title: "ベアアウェイの加速", minutes: 25 },
      { id: 7, title: "微風と強風の使い分け", minutes: 35 },
      { id: 8, title: "練習でのスピードテスト", minutes: 30 },
      { id: 9, title: "ライバル艇との比較分析", minutes: 30 },
    ],
  },
];

// ----- グローバル統計 (ヒーロー用) -----
export const mockStats = {
  totalSailors: 1284,
  totalArticles: 3492,
  totalQuestions: 612,
  activeNow: 47,
  todayArticles: 18,
  todayPosts: 124,
};

// ----- ホットタグ -----
export const mockHotTags = [
  { name: "sail-trim", count: 142 },
  { name: "race-strategy", count: 128 },
  { name: "wind-reading", count: 96 },
  { name: "heavy-weather", count: 87 },
  { name: "start", count: 81 },
  { name: "tuning", count: 73 },
  { name: "physical", count: 62 },
  { name: "beginner", count: 54 },
];

// ----- 艇種マスタ -----
export const mockBoatTypes = [
  { slug: "470", name: "470", count: 482 },
  { slug: "ilca", name: "ILCA", count: 391 },
  { slug: "snipe", name: "Snipe", count: 218 },
  { slug: "49er", name: "49er", count: 142 },
  { slug: "cruiser", name: "Cruiser", count: 388 },
  { slug: "other", name: "Other", count: 86 },
];

// ----- ユーティリティ: 相対時刻 -----
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "今";
  if (min < 60) return `${min}分前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}
