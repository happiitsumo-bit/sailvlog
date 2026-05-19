FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# ---- 開発モード（docker compose up で使用） ----
FROM base AS development
COPY next.config.* tsconfig.json ./
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- 本番ビルド（Vercel へのデプロイ用） ----
FROM base AS builder
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-slim AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
