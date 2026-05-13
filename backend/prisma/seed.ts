import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const boatTypes = [
    { name: "470", slug: "470", description: "470級 ディンギー。オリンピック種目の2人乗り艇。" },
    { name: "スナイプ", slug: "snipe", description: "スナイプ級 ディンギー。国内での競技人口が多い2人乗り艇。" },
    { name: "クルーザー", slug: "cruiser", description: "クルーザー。外洋レースや沿岸レースで使われる大型艇。" },
    { name: "レーザー / ILCA", slug: "laser-ilca", description: "レーザー（ILCA）。オリンピック種目の1人乗りシングルハンダー。" },
    { name: "49er", slug: "49er", description: "49er。高速な2人乗りスキフ。オリンピック種目。" },
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

  console.log("✅ Seed 完了: 艇種とタグを投入しました");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
