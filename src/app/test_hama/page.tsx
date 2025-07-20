// src/app/test_hama/page.tsx
import HamasanComponent from './hamasan';

export default function HamasanFeaturePage() {
  return (
    <div>
      {/* ページ全体のタイトル */}
      <h1>【はまさんの機能追加ページ】</h1>

      {/* ここに、hamasan.tsx で定義したコンポーネントを表示 */}
      <HamasanComponent />

      {/* トップページに戻るリンクをボタン風に */}
      <br />
      <a 
        href="/" 
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded inline-block" // ここにクラスを追加
        style={{ textDecoration: 'none' }} // リンクの下線を消すため
      >
        トップページに戻る
      </a>
    </div>
  );
}