'use client';
import { useState } from 'react';
import Link from "next/link"; // Linkコンポーネントは既にインポートされています

export default function Home() {
  // useStateを使った値（状態）管理
  const [getMessage, setGetMessage] = useState('');
  const [multiplyNumber, setMultiplyNumber] = useState('');
  const [multiplyResult, setMultiplyResult] = useState('');
  const [postMessage, setPostMessage] = useState('');
  const [postResult, setPostResult] = useState('');

  // FastAPIのエンドポイント設定
  const handleGetRequest = async () => {
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_API_ENDPOINT + "/common/hello");
      const data = await response.json();
      setGetMessage(data.message);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleMultiplyRequest = async () => {
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_API_ENDPOINT + `/common/multiply/${multiplyNumber}`);
      const data = await response.json();
      setMultiplyResult(data.doubled_value.toString());
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handlePostRequest = async () => {
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_API_ENDPOINT + "/common/echo", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: postMessage }),
      });
      const data = await response.json();
      setPostResult(data.message);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // ユーザーインターフェースの構築
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Next.jsとFastAPIの連携アプリ</h1>
      <div className="space-y-8">
        {/* GETリクエスト */}
        <section>
          <h2 className="text-xl font-bold mb-4">GETリクエストを送信</h2>
          <button
            onClick={handleGetRequest}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            GETリクエストを送信
          </button>
          {getMessage && (
            <p className="mt-2">サーバーからのGET応答: {getMessage}</p>
          )}
        </section>

        {/* ID指定のGET */}
        <section>
          <h2 className="text-xl font-bold mb-4">IDを指定してGETリクエストを送信</h2>
          <div className="flex gap-2">
            <input
              type="number"
              value={multiplyNumber}
              onChange={(e) => setMultiplyNumber(e.target.value)}
              className="border rounded px-2 py-1"
            />
            <button
              onClick={handleMultiplyRequest}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              送信
            </button>
          </div>
          {multiplyResult && (
            <p className="mt-2">FastAPIからの応答: {multiplyResult}</p>
          )}
        </section>

        {/* POSTリクエスト */}
        <section>
          <h2 className="text-xl font-bold mb-4">POSTリクエストを送信</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={postMessage}
              onChange={(e) => setPostMessage(e.target.value)}
              className="border rounded px-2 py-1"
            />
            <button
              onClick={handlePostRequest}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              送信
            </button>
          </div>
          {postResult && (
            <p className="mt-2">FastAPIからのPOST応答: {postResult}</p>
          )}
        </section>

        {/* Playページへのリンク */}
        <section>
          <Link href={"/play"}>
            <button className="btn btn-neutral w-20 border-0 bg-red-200 text-black hover:text-white">
              Play
            </button>
          </Link>
        </section>

        {/*「はまさん」ページへのリンク*/}
        <section>
          <h2 className="text-xl font-bold mb-4">はまさんの開発機能は以下です！</h2>
          <Link href="/test_hama"> {/* /test_hama へ遷移 */}
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              // Tailwind CSS のクラスを既存のボタンに合わせました。
              // 必要であれば btn btn-neutral w-20 border-0 bg-red-200 text-black hover:text-white のようなクラスも適用可能です
            >
              はまさんページへ
            </button>
          </Link>
          </section>
        {/*ここまで追加（はまさん）*/}

        {/*「えいちゃん」ページへのリンク*/}
        <section>
          <h2 className="text-xl font-bold mb-4">はまさんを完全にパクりました</h2>
          <Link href="/test_eiko"> {/* /test_eiko へ遷移 */}
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              // Tailwind CSS のクラスを既存のボタンに合わせました。
              // 必要であれば btn btn-neutral w-20 border-0 bg-red-200 text-black hover:text-white のようなクラスも適用可能です
            >
              えいちゃんページへ
            </button>
          </Link>
        </section>
        {/*ここまで追加（えいちゃん）*/}
        
        {/*「ゆかちん」ページへのリンク*/}
        <section>
          <h2 className="text-xl font-bold mb-4">ゆかちんのNetflix Role Searchへようこそ</h2>
          <Link href="/test_yuka"> {/* /test_yuka へ遷移 */}
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
              // Tailwind CSS のクラスを既存のボタンに合わせました。
              // 必要であれば btn btn-neutral w-20 border-0 bg-red-200 text-black hover:text-white のようなクラスも適用可能です
            >
              Netflix Role Search
            </button>
          </Link>
        </section>
        {/*ここまで追加（ゆかちん）*/}
      </div>
    </div>
  );
}