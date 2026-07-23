# SPIKE-01: GPX複数艇リプレイ性能検証（使い捨てプロトタイプ）

RESEARCH.md「スパイク計画 — SPIKE-01」の実施コード。**本実装ではない。** frontend/backend のnode_modulesやビルド設定には一切依存せず、このディレクトリ内で完結する。

結果の記録は `docs/dev-org/research/spike-replay.md` を参照。

## 構成

```
spike/
  gen-gpx.js          合成GPX生成スクリプト (6艇 x 3ノイズ水準)
  gpx/                生成されたGPXファイル (git管理外にしてよい使い捨てデータ)
  public/
    index.html        再生プロトタイプ (案a: Canvas 2D直描き)
    app.js
  measure.js          Puppeteer計測ハーネス
  measure-results.json  直近の計測生データ
  measure-run.log     直近の計測実行ログ
  screenshots/        Puppeteerで撮影したスクリーンショット
```

## 再現手順

```bash
cd spike
npm install                 # puppeteer, serve をこのディレクトリにのみ導入
node gen-gpx.js              # 合成GPX 18ファイルを spike/gpx/ に生成
npx serve -l 5055 .           # 別ターミナルでこのディレクトリを静的サーブ
node measure.js               # 計測実行 (要: 上記serveが起動済み)
```

- ブラウザで手動確認する場合: `http://localhost:5055/public/`（**末尾のスラッシュ必須**。`serve`パッケージが `/public/index.html` を `/public` へ301リダイレクトし、そのままだと相対パスの `app.js` 読み込みが404になる）
- `measure.js` は `SPIKE_URL` 環境変数で対象URLを上書き可能（デフォルト `http://localhost:5055/public/`）

## 再生プロトタイプの操作

- 再生/停止ボタン、1x/4x/8x速度切替、シークバー
- ノイズ選択(`clean`/`sigma3`/`sigma8`)でGPXを再ロード
- 航跡テールON/OFFトグル（デフォルトON、直近5分）
- boat1・boat3(欠測ギャップあり)を白枠でハイライト表示
- 画面左下に `frame p50=... p95=... fps~=... heap=...` のリアルタイム統計を表示

## Puppeteer計測ハーネスが計測する項目

`window.__spike` というグローバルAPIをapp.jsが公開しており、Puppeteerはこれを`page.evaluate`経由で操作する。

| API | 用途 |
|---|---|
| `play()` / `pause()` / `setSpeed(n)` | 再生制御 |
| `seekTo(seconds)` | シーク。戻り値がシーク〜再描画完了までのms |
| `frameDeltas` | rAFコールバック間隔のログ(配列) |
| `renderDurations` | `renderFrame()`自体の実行時間ログ(配列)。rAF間隔は60Hzディスプレイ同期に張り付くため、実際の描画コストを見るにはこちらが本質的 |
| `getHeapUsedBytes()` | `performance.memory.usedJSHeapSize`（Chrome限定API） |
| `loadVariant(name)` | ノイズ水準を切り替えて再ロード |
| `isLoaded()` / `lastLoadMs` | 初期ロード完了判定・所要時間 |

`measure.js` はこれらを叩いて `measure-results.json` に生数値を書き出し、`screenshots/` にσ比較・欠測ギャップ補間のスクリーンショットを保存する。

## スマホ実機計測（未実施・オーナー実施待ち）

1. `npx serve -l 5055 .` でPCをサーバ化
2. PCとスマホを同一LANに接続
3. スマホのブラウザで `http://<PCのLAN IP>:5055/public/` を開く
4. 再生・シーク・速度切替を実際に操作し、体感のカクつきとクラッシュ有無を確認
5. 画面左下の統計表示（`frame p50=... avgFps=...`）を目視でメモ

PASS基準(スマホ): 平均30fps以上・シーク1秒以内・初期ロード5秒以内・テールONでクラッシュしない。

## Q&A / トラブルシューティング

**Q. `serve` で `/public/index.html` を開くと `app.js` が404になる**
A. `serve`パッケージは拡張子付きURLをcleanUrlsで301リダイレクトする挙動があり、`/public/index.html` → `/public/index` → `/public`（末尾スラッシュなし）と2段階リダイレクトされる。この状態だと相対パス `app.js` は `/app.js` に解決されてしまう。**`http://localhost:5055/public/`（末尾スラッシュあり）に直接アクセスする**か、`measure.js`のように最初からそのURLを使うことで回避できる。

**Q. なぜrAFコールバック間隔(p50/p95)が常に16.7ms付近に張り付くのか。描画が重いのでは?**
A. 逆。16.7ms(≈60Hz)はディスプレイ同期間隔そのもので、rAFはこれより速く呼ばれない。もし描画が16.7ms予算を超えて重ければ、フレーム落ちして33ms・50msといった間隔が混ざるはず。実際には `renderDurations`（`renderFrame()`自体の実行時間）を計測すると p95でも0.2ms程度しかなく、描画コストは無視できるほど軽い。「rAF間隔だけ」を見ると誤読するので、本ハーネスは両方を記録している。

**Q. `performance.memory` が使えない環境では?**
A. Chrome系ブラウザ限定のAPI。Firefox/Safariでは`window.performance.memory`が存在しないため`getHeapUsedBytes()`は`null`を返す。今回はPC計測がHeadless Chrome前提のためこの制約は問題にならないが、案(b)実装時や他ブラウザでの追加計測が必要になった場合はDevTools Performanceパネルの手動プロファイルに切り替える必要がある。

**Q. 合成GPXの航跡が「本物のセーリングコースっぽくない」場合は?**
A. `gen-gpx.js`のタック角度・周期・速度パラメータ（`tackAngleUpwind`等）を調整すれば見た目は変えられるが、本スパイクの目的は「複数艇1Hzデータをブラウザが快適に再生できるか」の性能検証であり、コースの物理的リアリズムはスコープ外（PASS判定には影響しない）。

**Q. 欠測ギャップの艇(boat3)だけタイムラインで見た目が変わらないか心配**
A. `spike/screenshots/gap-interpolation.png` で確認済み。前後の既知点を線形補間して埋めるため、欠測区間はやや直線的な軌跡になるが描画は破綻しない。精密な補間アルゴリズム（速度を考慮した補間等）は本実装で別途検討する。
