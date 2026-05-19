FROM node:20-slim

WORKDIR /app

# 依存関係だけ先にインストール（キャッシュを活かす）
COPY package*.json ./
RUN npm install

# 設定ファイル類をコピー（srcはボリュームでマウントされる）
COPY next.config.* ./
COPY tsconfig.json ./

# ホットリロードをDockerボリューム越しでも動かすためのポーリング設定
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true

EXPOSE 3000

CMD ["npm", "run", "dev"]
