// src/app/room/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      // 古いiOS対策: randomUUIDが無い場合のフォールバック
      const rnd = (globalThis.crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      id = rnd;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

// 絶対URLを安全生成
function buildUrl(path: string) {
  const base = API_BASE || (typeof window !== "undefined" ? window.location.origin : "");
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

export default function RoomSelectPage() {
  const router = useRouter();

  // 状態: me の取得結果を明確に分離
  const [me, setMe] = useState<Me | null>(null);
  const [meStatus, setMeStatus] = useState<"idle" | "loading" | "ok" | "unauth" | "error">("idle");
  const [meError, setMeError] = useState<string>("");

  const [roster, setRoster] = useState<Roster | null>(null);
  const [rosterError, setRosterError] = useState<string>("");
  const [showCameraOptions, setShowCameraOptions] = useState(false);

  const didRedirectRef = useRef(false);
  
  const myDeviceId = useMemo(getOrCreateDeviceId, []);
  const room = me ? `acc:${me.account_id}` : null;

  const fetchMe = useCallback(async (signal: AbortSignal) => {
    setMeStatus("loading");
    setMeError("");
    try {
      const res = await fetch(buildUrl("/auth/me"), {
        credentials: "include",
        cache: "no-store",
        signal,
        headers: { Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) {
        setMeStatus("unauth");
        return;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const j = (await res.json()) as Me;
      setMe(j);
      setMeStatus("ok");
    } catch (e: any) {
      if (signal.aborted) return; // 遷移/タイムアウト等
      setMeError(e?.message ?? "network error");
      setMeStatus("error");
    }
  }, []);

  // 認証確認（10秒タイムアウト＋確実な中断）
  useEffect(() => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10_000);
    fetchMe(ctrl.signal);
    return () => {
      clearTimeout(to);
      ctrl.abort();
    };
  }, [fetchMe]);

  // 未認証のときだけ一度だけ /login に置換
  useEffect(() => {
    if (meStatus === "unauth" && !didRedirectRef.current) {
      didRedirectRef.current = true;
      router.replace(`/login?next=/room`);
    }
  }, [meStatus, router]);

  // 参加者情報の取得（okのときだけ、8秒で中断）
  useEffect(() => {
    if (meStatus !== "ok" || !room) return;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8_000);

    (async () => {
      try {
        const url = new URL("/ws/roster", API_BASE || window.location.origin);
        url.searchParams.set("room", room);
        const res = await fetch(url.toString(), {
          credentials: "include",
          cache: "no-store",
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const j = (await res.json()) as Roster;
        setRoster(j);
        setRosterError("");
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        setRosterError(e?.message ?? "network error");
      } finally {
        clearTimeout(to);
      }
    })();

    return () => {
      clearTimeout(to);
      ctrl.abort();
    };
  }, [meStatus, room]);

  const retryAuth = () => {
    const ctrl = new AbortController();
    fetchMe(ctrl.signal);
  };

  const handleCameraClick = () => {
    setShowCameraOptions(true);
  };

  const handleBackToMain = () => {
    setShowCameraOptions(false);
  };

  return (
    <main className="min-h-screen p-4" style={{ backgroundColor: '#BDD9D7' }}>
      {meStatus === "loading" || meStatus === "idle" ? (
        <div className="mx-auto max-w-md rounded-xl bg-white/80 p-4 ring-1 ring-rose-100">
          認証確認中…
        </div>
      ) : meStatus === "error" ? (
        <div className="mx-auto max-w-md space-y-3 rounded-xl bg-white/90 p-4 ring-1 ring-rose-200">
          <div className="font-semibold text-rose-800">通信エラー</div>
          <div className="text-sm text-rose-700 break-all">{meError}</div>
          <button
            onClick={retryAuth}
            className="w-full rounded-xl bg-rose-500 px-4 py-2 font-semibold text-white hover:bg-rose-600"
          >
            再試行
          </button>
        </div>
      ) : meStatus === "unauth" ? (
        <div className="mx-auto max-w-md space-y-3 rounded-xl bg-white/90 p-4 ring-1 ring-rose-200">
          <div className="font-semibold text-rose-800">ログインが必要です</div>
          <div className="text-sm text-rose-700">ログインページへ遷移します…</div>
          <Link href="/login?next=/room" className="block">
            <button className="w-full rounded-xl bg-rose-500 px-4 py-2 font-semibold text-white hover:bg-rose-600">
              ログインへ
            </button>
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-md space-y-4">
          <header className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-rose-100">
            <h1 className="text-xl text-rose-800">機能選択</h1>
            <div className="mt-2 text-sm text-rose-700">
              accid: <b>{me!.account_id}</b> / room: <b>acc:{me!.account_id}</b> / device: <b>{myDeviceId}</b>
            </div>
            <div className="mt-2 text-sm text-rose-700">
              現在参加者：RECORDER {roster?.counts.recorder ?? 0}/1, SHOOTER {roster?.counts.shooter ?? 0}/4
              {rosterError && <span className="ml-2 text-rose-500">(取得エラー: {rosterError})</span>}
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
