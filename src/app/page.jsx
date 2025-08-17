'use client';
import { useState } from 'react';
import Link from "next/link"; // Linkコンポーネントは既にインポートされています

export default function Home() {

  // ユーザーインターフェースの構築
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">HondaCamera</h1>
      <div className="space-y-8">

        <section>
<<<<<<< HEAD
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
=======
>>>>>>> 90d6d63 (大改造ビフォーアフター)
          <Link href="/login">
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              ログイン（アルバム、カメラ用）
            </button>
          </Link>
        </section>


        <section>
          <h2 className="text-xl font-bold mb-4">カメラ機能</h2>
          <Link href="/mic_camera">
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              go
            </button>
          </Link>
        </section>

        <section>
          <Link href="/album">
            <button
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              album
            </button>
          </Link>
        </section>
      </div>
    </div>
  );
}