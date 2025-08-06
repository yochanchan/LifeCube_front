// src/app/test_speech/page.tsx (ダイナミックインポート版)

"use client"; // この行は念のため残しておきます

import dynamic from 'next/dynamic';

// SpeechComponentをダイナミックインポートし、サーバーサイドレンダリング(SSR)を無効にする
const SpeechComponentWithNoSSR = dynamic(
  () => import('./SpeechComponent'),
  { ssr: false }
);

export default function SpeechPage() {
  return (
    <main>
      <h1>音声認識テストページ (最終版)</h1>
      <hr />
      {/* SSR無効のコンポーネントを呼び出す */}
      <SpeechComponentWithNoSSR />
    </main>
  );
}