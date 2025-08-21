// src/app/page.jsx
'use client';
import Link from "next/link";

export default function Home() {
  return (
    <div className="p-8 bg-teal-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">HondaCamera</h1>
      <div className="space-y-8">
        <section>
          <Link href="/login">
            <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
              ログイン（アルバム、カメラ用）
            </button>
          </Link>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">機能</h2>
          <div className="flex gap-3 flex-wrap">
            <Link href="/room">
              <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded">
                機能選択（/room）
              </button>
            </Link>
            <Link href="/recorder">
              <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
                RECORDER（/recorder）
              </button>
            </Link>
            <Link href="/shooter">
              <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded">
                SHOOTER（/shooter）
              </button>
            </Link>
            <Link href="/album">
              <button className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded">
                アルバム（/album）
              </button>
            </Link>
            <Link href="/display">
              <button className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded">
                表示（/display）
              </button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
