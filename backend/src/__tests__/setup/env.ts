// qa-engineer (T-90): jestのsetupFiles。テストファイル(index.ts等)がimportされるより前に
// .env.test を読み込み、process.env に DATABASE_URL 等のテスト用値を設定する。
// index.ts 側の `import "dotenv/config"` はデフォルトで「既に設定済みの環境変数を上書きしない」ため、
// ここで先に設定しておけば本番用 .env ではなくこちらの値が使われる。
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env.test") });
