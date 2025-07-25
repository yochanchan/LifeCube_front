// src/app/test_eiko/eichan.tsx
import EichanComponent from './eichan';
import Link from 'next/link'; 

export default function EichanFeaturePage() {
  return (
    <div>
      {/* ページ全体のタイトル */}
      <h1>【えいちゃんの機能追加ページ】</h1>

      {/* ここに、Eichan.tsx で定義したコンポーネントを表示 */}
      <EichanComponent />

      {/* トップページに戻るリンクをボタン風に */}
      <br />
      <Link 
        href="/" 
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded inline-block" // ここにクラスを追加
        style={{ textDecoration: 'none' }} // リンクの下線を消すため
      >
        トップページに戻る
      </Link>
    </div>
  );
}

