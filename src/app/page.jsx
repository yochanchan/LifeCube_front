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
          <h2 className="text-xl font-bold mb-4">はまさんの宿題ページは以下です（音声認識は下の方に追加）</h2>
          <Link href="/mic_camera"> {/* /test_hama へ遷移 */}
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              はまさんページへ
            </button>
          </Link>
        </section>

        {/*「えいちゃん」ページへのリンク*/}
        <section>
          <h2 className="text-xl font-bold mb-4">はまさんを完全にパクりました</h2>
          <Link href="/test_eiko"> {/* /test_eiko へ遷移 */}
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              えいちゃんページへ
            </button>
          </Link>
        </section>

        {/*「ゆかちん」ページへのリンク*/}
        <section>
          <h2 className="text-xl font-bold mb-4">ゆかちんページ</h2>
          <Link href="/test_yuka"> {/* /test_yuka へ遷移 */}
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              トリガー判定機能
            </button>
          </Link>
        </section>

        {/*「ようちゃん」ページへのリンク*/}
        <section>
          <h2 className="text-xl font-bold mb-4">ようちゃんページ</h2>
          <Link href="/test_yoch">
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              yochan_WebSocket
            </button>
          </Link>
          <Link href="/yochan_camera">
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              yochan_camera
            </button>
          </Link>
          <Link href="/test_camera">
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              test_camera
            </button>
          </Link>
          {/*沢田つけたし*/}
          <Link href="/test_display">
            <button
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded"
            >
              test_display
            </button>
          </Link>
          {/*沢田つけたし*/}
          <Link href="/album">
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              album
            </button>
          </Link>
          <Link href="/login">
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              ログイン（アルバム、カメラ用）
            </button>
          </Link>
        </section>

        {/* ▼▼▼▼▼ ここからが追加部分 ▼▼▼▼▼ */}
        {/*「音声認識-シャッター判定」ページへのリンク*/}
        <section>
          <h2 className="text-xl font-bold mb-4">リアルタイム音声認識機能～シャッター判定</h2>
          <Link href="/speech_shatter"> {/* /speech_shatter へ遷移 */}
            <button
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded"
            // 他のボタンと区別しやすいように、紫色(purple)にしてみました。
            >
              音声認識～シャッター判定のページへ
            </button>
          </Link>
        </section>
        {/* ▲▲▲▲▲ ここまでが追加部分 ▲▲▲▲▲ */}

      </div>
    </div>
  );
}