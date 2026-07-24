// qa-engineer (T-90): 全テストファイル共通のグローバルフック(setupFilesAfterEnv)。
// 各testの前にDBを空にしてから開始する（前のtestが残したデータに依存する偽陽性/偽陰性を防ぐ）。
// 個別のテストファイルでさらに独自のbeforeEach/afterAllを足しても問題ない(併用可能)。
import { resetDb } from "../helpers/resetDb";
import prisma from "../../database";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
