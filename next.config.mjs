// next.config.mjs  next.config.jsだったが、なぜかmjs  
import 'dotenv/config'           // ★ CJS の require ではなく import

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',          // ← そのまま追加
  env: {
    /** 
     * サーバーだけで使う例。
     * ブラウザでも参照したい場合は NEXT_PUBLIC_ を付ける:
     *   NEXT_PUBLIC_API_ENDPOINT: process.env.NEXT_PUBLIC_API_ENDPOINT
     */
    API_ENDPOINT: process.env.API_ENDPOINT,
  },
};

export default nextConfig;        // ★ ESM の export