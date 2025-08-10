// src/app/speech_shatter/page.tsx

"use client";

import dynamic from 'next/dynamic';

// ▼▼▼【変更点】ファイル名に合わせて、コンポーネントのインポート元を修正 ▼▼▼
// './component' を動的にインポートします。
const SpeechShatterComponentWithNoSSR = dynamic(
  () => import('./component'),
  { ssr: false }
);

// ▼▼▼【変更点】関数名をページの内容に合わせて変更 ▼▼▼
export default function SpeechShatterPage() {
  return (
    <main>
      <h1>音声シャッターページ</h1>
      <hr />
      <SpeechShatterComponentWithNoSSR />
    </main>
  );
}