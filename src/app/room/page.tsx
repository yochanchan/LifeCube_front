// src/app/room/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");

type Me = { account_id: number; email: string; role: string };
type Roster = { recorder: string | null; shooters: string[]; counts: { recorder: number; shooter: number } };

function getOrCreateDeviceId(): string {
  try {
    const KEY = "device_uid";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

export default function RoomSelectPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [showCameraOptions, setShowCameraOptions] = useState(false);
  const myDeviceId = useMemo(getOrCreateDeviceId, []);
  const room = me ? `acc:${me.account_id}` : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error("unauth");
        const j = (await res.json()) as Me;
        if (!cancelled) setMe(j);
      } catch {
        if (!cancelled) router.replace(`/login?next=/room`);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!authChecked || !room) return;
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(`${API_BASE}/ws/roster`, window.location.href);
        url.searchParams.set("room", room);
        const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as Roster;
          if (!cancelled) setRoster(j);
        }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [authChecked, room]);

  const handleCameraClick = () => {
    setShowCameraOptions(true);
  };

  const handleBackToMain = () => {
    setShowCameraOptions(false);
  };

  return (
    <main className="min-h-screen p-4" style={{ backgroundColor: '#BDD9D7' }}>
      {!authChecked || !me ? (
        <div className="mx-auto max-w-md rounded-xl bg-white/80 p-4 ring-1 ring-rose-100">認証確認中…</div>
      ) : (
        <div className="mx-auto max-w-md space-y-4">
          <header className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-rose-100">
            <h1 className="text-xl text-rose-800">機能選択</h1>
            <div className="mt-2 text-sm text-rose-700">
              accid: <b>{me.account_id}</b> / room: <b>acc:{me.account_id}</b> / device: <b>{myDeviceId}</b>
            </div>
            <div className="mt-2 text-sm text-rose-700">
              現在参加者：RECORDER {roster?.counts.recorder ?? 0}/1, SHOOTER {roster?.counts.shooter ?? 0}/4
            </div>
          </header>

          {!showCameraOptions ? (
            // メインメニュー
            <div className="space-y-3">
              {/* 撮るボタン */}
              <button
                onClick={handleCameraClick}
                className="w-full rounded-xl bg-white p-6 text-center hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#B6A98B' }}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-blue-600 text-sm">撮る</span>
              </button>
              
              {/* アルバムボタン */}
              <Link href="/album" className="block">
                <div className="w-full rounded-xl bg-white p-6 text-center hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#FCF98B' }}>
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <span className="text-blue-600 text-sm">アルバム</span>
                </div>
              </Link>
              
              {/* トップへ戻るボタン */}
              <Link href="/" className="block">
                <button className="w-full rounded-xl bg-white px-4 py-2 ring-1 ring-rose-200 hover:bg-rose-50" style={{ color: '#2B578A' }}>
                  トップへ戻る
                </button>
              </Link>
            </div>
          ) : (
                         // カメラオプションメニュー
             <div className="space-y-3">
               {/* 車内操作ボタン */}
               <Link href="/recorder" className="block">
                 <div className="w-full rounded-xl bg-white p-6 text-center hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200">
                   <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#B6A98B' }}>
                     <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                     </svg>
                   </div>
                   <span className="text-blue-600 text-sm">車内操作</span>
                 </div>
               </Link>
               
               {/* 車外カメラボタン */}
               <Link href="/shooter" className="block">
                 <div className="w-full rounded-xl bg-white p-6 text-center hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200">
                   <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#5BD3CB' }}>
                     <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                     </svg>
                   </div>
                   <span className="text-blue-600 text-sm">車外カメラ</span>
                 </div>
               </Link>
               
               {/* 戻るボタン */}
               <button
                 onClick={handleBackToMain}
                 className="w-full rounded-xl bg-white px-4 py-2 ring-1 ring-blue-200 hover:bg-blue-50 text-blue-600"
               >
                 ← 戻る
               </button>
             </div>
          )}
        </div>
      )}
    </main>
  );
}
