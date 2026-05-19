import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const boatTypes = [
    { name: "470", slug: "470", description: "470級 ディンギー。オリンピック種目の2人乗り艇。" },
    { name: "スナイプ", slug: "snipe", description: "スナイプ級 ディンギー。国内での競技人口が多い2人乗り艇。" },
    { name: "クルーザー", slug: "cruiser", description: "クルーザー。外洋レースや沿岸レースで使われる大型艇。" },
    { name: "ILCA", slug: "ilca", description: "ILCA（旧レーザー）。オリンピック種目の1人乗りシングルハンダー。" },
    { name: "49er", slug: "49er", description: "49er。高速な2人乗りスキフ。オリンピック種目。" },
    { name: "420", slug: "420", description: "420級 ディンギー。高校生に人気の2人乗り練習艇。" },
    { name: "OP", slug: "op", description: "オプティミスト（OP）。ジュニア向け1人乗り入門艇。" },
    { name: "その他", slug: "other", description: "上記以外の艇種。" },
  ];

  for (const bt of boatTypes) {
    await prisma.boatType.upsert({
      where: { slug: bt.slug },
      update: {},
      create: bt,
    });
  }

  const tags = [
    { name: "セール調整", slug: "sail-trim" },
    { name: "レース戦略", slug: "race-strategy" },
    { name: "チューニング", slug: "tuning" },
    { name: "風読み", slug: "wind-reading" },
    { name: "マーク回航", slug: "mark-rounding" },
    { name: "スタート", slug: "start" },
    { name: "フィジカル", slug: "physical" },
    { name: "メンテナンス", slug: "maintenance" },
    { name: "国際大会", slug: "international" },
    { name: "初心者向け", slug: "beginner" },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }

  // コースデータ
  const bt470 = await prisma.boatType.findUnique({ where: { slug: "470" } });
  const btILCA = await prisma.boatType.findUnique({ where: { slug: "laser-ilca" } });
  const btCruiser = await prisma.boatType.findUnique({ where: { slug: "cruiser" } });

  const courses = [
    {
      slug: "470-foundations",
      title: "470 FOUNDATIONS",
      subtitle: "470級の基礎から大会出場まで",
      description: "470級を始める人のための12レッスンコース。艤装・基本操作・タッキング・ジャイビングからレース出場の準備までを体系的に学べます。",
      level: "BEGINNER",
      estimatedHours: 8,
      enrolledCount: 342,
      accentColor: "#ff3d00",
      boatTypeId: bt470?.id ?? null,
      lessons: [
        { title: "艇の各部名称と艤装", minutes: 25 },
        { title: "セールセッティングの基本", minutes: 30 },
        { title: "出艇前のチェックリスト", minutes: 20 },
        { title: "ハイクアウトとボディポジション", minutes: 35 },
        { title: "タッキングの分解動作", minutes: 40 },
        { title: "ジャイビングの安全な手順", minutes: 40 },
        { title: "上マークアプローチ", minutes: 30 },
        { title: "ダウンウィンドの基本", minutes: 35 },
        { title: "風の見方入門", minutes: 30 },
        { title: "初めてのレース", minutes: 45 },
        { title: "沈と復帰", minutes: 25 },
        { title: "練習メニューの組み立て方", minutes: 30 },
      ],
    },
    {
      slug: "race-tactics-intermediate",
      title: "RACE TACTICS",
      subtitle: "レース戦術 中級コース",
      description: "スタートからフィニッシュまで、各レグの判断力を磨く戦術コース。470/ILCA/Snipe など艇種横断で学べます。",
      level: "INTERMEDIATE",
      estimatedHours: 6,
      enrolledCount: 218,
      accentColor: "#00d9ff",
      boatTypeId: null,
      lessons: [
        { title: "スタートライン分析", minutes: 35 },
        { title: "風の振れと永続シフト", minutes: 40 },
        { title: "コース選択の意思決定", minutes: 35 },
        { title: "上マーク回航のレーン取り", minutes: 30 },
        { title: "リーチングレッグの戦術", minutes: 30 },
        { title: "ダウンウィンドのジャイブ判断", minutes: 35 },
        { title: "他艇との位置取り", minutes: 30 },
        { title: "規則と抗議", minutes: 40 },
        { title: "シリーズ戦の戦略", minutes: 30 },
        { title: "メンタル管理", minutes: 25 },
      ],
    },
    {
      slug: "offshore-navigation",
      title: "OFFSHORE NAVIGATION",
      subtitle: "外洋航海と天気図の読み方",
      description: "外洋セーリングのナビゲーションとウェザールーティングを深く学ぶ上級コース。GRIBデータの読み方から実戦での意思決定まで。",
      level: "ADVANCED",
      estimatedHours: 10,
      enrolledCount: 96,
      accentColor: "#c4ff00",
      boatTypeId: btCruiser?.id ?? null,
      lessons: [
        { title: "海図と海図記号", minutes: 60 },
        { title: "潮汐・潮流の読み方", minutes: 50 },
        { title: "GPSとプロッターの活用", minutes: 45 },
        { title: "天気図の基礎", minutes: 60 },
        { title: "GRIBデータとルーティング", minutes: 70 },
        { title: "ワッチ体制の組み立て", minutes: 40 },
        { title: "緊急時の判断", minutes: 55 },
        { title: "回航計画の立て方", minutes: 60 },
      ],
    },
    {
      slug: "ilca-speed",
      title: "ILCA SPEED LAB",
      subtitle: "ILCAのスピード追求",
      description: "ILCA級のスピード向上に特化したコース。セッティング、ボディムーブ、波対応を徹底解説。",
      level: "INTERMEDIATE",
      estimatedHours: 5,
      enrolledCount: 178,
      accentColor: "#ff3d00",
      boatTypeId: btILCA?.id ?? null,
      lessons: [
        { title: "アウトホールとカニンガム", minutes: 30 },
        { title: "バングテンションの極意", minutes: 35 },
        { title: "アップウィンドのボディムーブ", minutes: 40 },
        { title: "波への当て方", minutes: 35 },
        { title: "ダウンウィンドのパンピング", minutes: 30 },
        { title: "ベアアウェイの加速", minutes: 25 },
        { title: "微風と強風の使い分け", minutes: 35 },
        { title: "練習でのスピードテスト", minutes: 30 },
        { title: "ライバル艇との比較分析", minutes: 30 },
      ],
    },
  ];

  for (const { lessons, ...courseData } of courses) {
    const existing = await prisma.course.findUnique({ where: { slug: courseData.slug } });
    if (!existing) {
      await prisma.course.create({
        data: {
          ...courseData,
          courseArticles: {
            create: lessons.map((l, idx) => ({ ...l, position: idx + 1 })),
          },
        },
      });
    }
  }

  console.log("✅ Seed 完了: 艇種・タグ・コースを投入しました");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
