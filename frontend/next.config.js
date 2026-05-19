/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 本番Docker・Railwayデプロイ用。Vercelへの直接デプロイ時はこの設定は無視される。
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

module.exports = nextConfig;
