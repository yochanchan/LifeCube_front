// src/app/page.jsx
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