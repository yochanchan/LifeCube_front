// src/app/shooter/ShooterClient.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CameraPreview from "../components/CameraPreview";
import { useRoomSocket } from "../../hooks/useRoomSocket";
import LatestPreview from "../components/LatestPreview";
import { apiclient } from "@/lib/apiclient";

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "";

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

type Me = { account_id: number; email: string; role: string };

export default function ShooterClient() {
  const router = useRouter();

  // 認証関連
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const authReady = authChecked && !!me;

  const [status, setStatus] = useState("初期化中…");

  const myDeviceId = useMemo(getOrCreateDeviceId, []);
  const room = me ? `acc:${me.account_id}` : null;

  // 認証チェック
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await apiclient.getJSON<Me>("/auth/me");
        if (!cancelled) {
          setMe(j);
          setStatus("準備完了");
        }
      } catch {
        if (!cancelled) {
          setStatus("未ログインのため /login に移動します");
          router.replace(`/login?next=/shooter`);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // WS 接続
  const { wsRef, readyState, sendJson, join, joinedRole, roster } = useRoomSocket({
    base: WS_BASE,
    room,
    deviceId: myDeviceId,
    pingIntervalMs: 5000,
    onMessage: (msg) => {
      if (msg?.type === "take_photo" && (msg as any).origin_device_id !== myDeviceId) {
        // 他端末からのトリガーだけ拾う
        window.dispatchEvent(new Event("app:take_photo"));
      }
    },
  });

  // SHOOTER として join
  useEffect(() => {
    if (!authReady || !room) return;
    if (readyState !== WebSocket.OPEN) return;
    if (joinedRole) return;

    let disposed = false;
    (async () => {
      const res = await join("shooter");
      if (disposed) return;

      if ("reason" in res) {
        alert(
          res.reason === "shooter_full"
            ? "SHOOTERの枠が埋まっています。"
            : res.reason === "invalid_role"
              ? "無効なロールです。"
              : "参加できませんでした。"
        );
        setStatus(`join_denied: ${res.reason}`);
        return;
      }
      setStatus("SHOOTERとして参加しました");
    })();

    return () => {
      disposed = true;
    };
  }, [authReady, room, readyState, joinedRole, join]);

  const manualSnap = useCallback(() => {
    // 手動撮影（CameraPreview 内のイベントに委ねる）
    window.dispatchEvent(new Event("app:take_photo"));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      // ローカルストレージのJWTトークンを削除
      localStorage.removeItem('jwt_token');
      // ログインページにリダイレクト
      router.replace('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
      // エラーが発生してもログインページにリダイレクト
      router.replace('/login');
    }
  }, [router]);

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#BDD9D7' }}>
      {!authReady ? (
        <div className="mx-auto max-w-5xl p-4">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-rose-100 text-rose-700">{status}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-md p-4 space-y-4 sm:max-w-lg">
          <header className="p-4">
            <div className="flex justify-center items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#2B578A' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h1 className="text-xl" style={{ color: '#2B578A' }}>
                車外カメラ
              </h1>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#2B578A' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            
          </header>

          {/* 情報表示（ヘッダーの下に表示） */}
          <div className="text-[10px] text-right" style={{ color: '#2B578A' }}>
            <div>
              ID:{me?.account_id} Room:{room} RECORDER {roster?.counts.recorder ?? 0}/1, SHOOTER {roster?.counts.shooter ?? 0}/4
            </div>
          </div>

          {/* 上：カメラ（WSの take_photo を受けて自動撮影。CameraPreview が対応済み） */}
          <section aria-label="カメラ" className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-emerald-100">
            <CameraPreview apiBase={API_BASE} wsRef={wsRef} myDeviceId={myDeviceId} />
          </section>

                     {/* 下：直近の写真プレビュー（SHOOTERポリシー：自分の写真のみ） */}
           <LatestPreview
             apiBase={API_BASE}
             wsRef={wsRef}
             myDeviceId={myDeviceId}
             policy="shooter"
             debounceMs={1200}
             wsReady={readyState}
           />

          {/* ナビゲーションボタン */}
          <section className="mt-6">
            <div className="grid grid-cols-4 gap-3">
              {/* 車内操作ボタン */}
              <button
                onClick={() => router.push('/recorder')}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                                     <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#B6A98B' }}>
                     <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5a6.5 6.5 0 006.5-6.5v-4a6.5 6.5 0 00-13 0v4a6.5 6.5 0 006.5 6.5z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5v3" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 22h8" />
                     </svg>
                   </div>
                                                                           <span className="text-[10px]" style={{ color: '#2B578A' }}>車内カメラ</span>
                </div>
              </button>

              {/* アルバムボタン */}
              <button
                onClick={() => router.push('/album')}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FCF98B' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#B6A98B' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                                     <span className="text-[10px]" style={{ color: '#2B578A' }}>アルバム</span>
                </div>
              </button>

              {/* 戻るボタン */}
              <button
                onClick={() => router.push('/room')}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2B578A' }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </div>
                                     <span className="text-[10px]" style={{ color: '#2B578A' }}>トップに戻る</span>
                </div>
              </button>

              {/* ログアウトボタン */}
              <button
                onClick={handleLogout}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#7B818B' }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                                     <span className="text-[10px]" style={{ color: '#2B578A' }}>ログアウト</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
