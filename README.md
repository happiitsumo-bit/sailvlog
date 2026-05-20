# sailvlog

> **Knowledge that sails.** — セーラーのための技術交流プラットフォーム

`sailvlog` は、ヨット競技（セーリング）に特化したナレッジシェアプラットフォームです。
ブログ、Q&A、リアルタイムフィード、学習コースを統合し、初心者からプロセーラーまでが技術を磨き、共有するための場所を提供します。

## ⛵ プロジェクト・コンセプト
*   **Aesthetic:** 「Claude-paper」テーマを採用。上質な雑誌や論文のような、知覚的で落ち着いた読書体験。
*   **Focus:** PCでの運用を最優先した高機能なUI/UX。3カラムレイアウトによる情報の俯瞰性と効率的なナレッジ管理。
*   **Community:** 艇種（470, ILCA, Snipe等）ごとの深いナレッジ共有と、タイムラインによる気軽な交流。

## 🛠 技術スタック
### Frontend
*   **Next.js 14 (App Router)** - React / TypeScript
*   **Vanilla CSS** - 高速で柔軟なスタイリングとデザイントークン管理

### Backend
*   **Node.js / Express** - TypeScript
*   **Prisma ORM** - 型安全なデータベース操作
*   **PostgreSQL** - 堅牢なリレーショナルデータベース

### Infrastructure
*   **Docker / Docker Compose** - 開発環境の一貫性

## 🚀 クイックスタート

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd sailvlog
```

### 2. 環境変数の設定
`backend/.env.example` を参考に、DB接続情報などの設定を行ってください。

### 3. Dockerでの起動
```bash
docker-compose up -d
```
起動後、以下のURLでアクセス可能です：
*   Frontend: `http://localhost:3000`
*   Backend API: `http://localhost:8000`

## 📂 ディレクトリ構造
*   `frontend/`: Next.js アプリケーション
*   `backend/`: Express API サーバー
*   `docs/`: 仕様書・設計ドキュメント
*   `design_bundle/`: デザインシステムのアセット

## 📋 今後のロードマップ（部内共有フェーズ）
1.  **PCレイアウトの最適化:** 3カラムレイアウトの完全実装
2.  **Notion連携:** Notionページへの埋め込み最適化とポータル化
3.  **検索システムの強化:** クイックコマンド（Cmd+K）の実装
4.  **部内運用開始:** 実際の練習記録や技術QAの蓄積

## 🤝 貢献について
現在は部内限定で開発・運用を行っています。バグ報告や機能要望は、Notionのフィードバック用ページまでお願いします。

---

## 📝 ライセンス
Copyright © 2024 sailvlog team. All rights reserved.
