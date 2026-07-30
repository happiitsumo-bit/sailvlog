import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// T-22: 収録ハンドブック（静的1ページ）。内容はVALIDATION.md §2-1/2-2の一次調査・収録手順書を踏襲。
const HANDBOOK_MD = `
## Geo Trackerの設定（出艇前に一度だけ）

sailvlogは1Hz（1秒間隔）のGPXを前提に設計しています。**[Geo Tracker](https://geo-tracker.org/en/faq/)**（iOS/Android両対応・無料）を推奨します。

1. Geo Trackerをインストールし、**記録間隔を最短（1〜2秒）** に設定する
2. 位置情報の許可を **「常に許可」** にする（「アプリ使用中のみ」だと画面ロック後に記録が止まる端末がある）
3. 端末の **低電力モードをOFF** にする（バックグラウンド記録が止まる端末がある）
4. 一度、自転車か徒歩で3〜5分ほど試し録りしてGPXを書き出し、点が1秒間隔で並んでいるか確認する（練習・レース当日にいきなり本番投入しない）

## 出艇前チェックリスト

- [ ] Geo Trackerを開き「記録開始」を押した
- [ ] 画面をロックした
- [ ] スマホを防水袋（ジップロックで可）に入れた
- [ ] 艇内の定位置（バウバッグ等、水がかかりにくく動かない場所）に固定した
- [ ] 低電力モードがOFFになっていることを確認した

## 着艇後にやること

- [ ] Geo Trackerを開き「記録停止」を押す
- [ ] 「GPXで書き出し（エクスポート）」を選ぶ
- [ ] ファイル名を \`日付_セール番号.gpx\`（例: \`20260724_4423.gpx\`）にリネームしておくと、後で取り込むときに艇を間違えにくい
- [ ] マネ艇担当のLINE・部のGoogleDrive等、いつも集約している場所へ送る。**原本のGPXは消さない**

## sailvlogへの取込

1. ログイン後、[Sessions](/sessions) → 「+ Import GPX」
2. タイトル・チーム・（任意で）練習/レース区分を入力
3. 各艇のGPXファイルをまとめて選択する（艇ごとに1ファイル）
4. 艇ラベル（セール番号や乗組員名など）を確認・修正し、重ね描きプレビューで航跡がおかしくないか目視確認
5. 「取り込む」で保存。壊れたGPXが混ざっていると保存できないので、エラーが出たファイルだけ外してやり直す

## 反省会前にURLを開いておく

無料ホスティングはアクセスが一定時間無いとスリープし、次のアクセス時に再起動で数十秒〜1分ほどかかることがあります（cold start）。**反省会が始まる直前・席に着く前に一度セッションのページを開いておく**と、実際に使うタイミングで待たされずに済みます。

## 1Hz GPXが出せる手段なら何でも可

Geo Trackerが第一推奨ですが、**1秒間隔でGPXを出力できる記録手段であれば代替可**です（例: iOSなら[Open GPX Tracker](http://www.merlos.org/iOS-Open-GPX-Tracker/)）。記録間隔が5秒以上のアプリ（ルートヒストリー等）は、タックの位置やタイミングを議論するには粗くなりがちなので避けてください。迷ったら試し録り→GPXを開いて点の間隔を確認、が一番確実です。
`;

export default function HandbookPage() {
  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <h1 className="page-header-title">収録ハンドブック</h1>
        <p className="page-header-sub">
          GPS収録からsailvlogへの取込・反省会での使い方まで。マネ艇・救助艇担当の方はこのページのとおりに進めればOKです。
        </p>
      </div>

      <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{HANDBOOK_MD}</ReactMarkdown>
      </div>
    </div>
  );
}
