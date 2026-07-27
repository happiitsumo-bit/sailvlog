FROM node:20-slim AS base

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# m-06修正（2026-07-27, REVIEW-backend-2.md）: npm installはpackage-lock.jsonを無視するため
# ビルドの再現性が無く、CI(npm ci使用)と本番ビルドで異なる依存バージョンが入り得た
# （実際に@types/jsonwebtokenのマイナー更新で型エラーが本番ビルドまで露見した前例がある）。
# npm ci --dry-runでlockfileとの整合を確認済み。
RUN npm ci

COPY . .
RUN npx prisma generate

# ---- 開発モード（docker compose up で使用） ----
FROM base AS development
EXPOSE 8000
CMD ["npm", "run", "dev"]

# ---- 本番ビルド（Railway などへのデプロイ用） ----
FROM base AS builder
RUN npm run build

FROM node:20-slim AS production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# M3-03修正（2026-07-28, REVIEW-backend-3.md）: assertJwtSecretConfigured()のプレースホルダ検知・
# 長さチェックはNODE_ENV==="production"のときだけ厳格化する設計にした。Renderのダッシュボード側で
# NODE_ENVが設定されているか確認できないため、ここで明示的に固定し、デプロイ環境の設定漏れに
# 依存しない形で本番の厳格チェックを保証する。
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 8000
CMD ["node", "dist/index.js"]
