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

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#BDD9D7' }}>
      {!authReady ? (
        <div className="mx-auto max-w-5xl p-4">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-rose-100 text-rose-700">{status}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-md p-4 space-y-4 sm:max-w-lg">
          <header className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-emerald-100">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl text-emerald-800">Shooter</h1>
              <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                account_id: <strong>{me?.account_id}</strong>
              </span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                room: <strong>{room}</strong>
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={manualSnap}
                className="rounded-full px-4 py-2 text-white hover:opacity-80 transition-opacity"
                style={{ backgroundColor: '#2B578A' }}
              >
                手動で撮影
              </button>
              <span className="ml-auto text-xs text-emerald-600">
                WS: {["CONNECTING", "OPEN", "CLOSING", "CLOSED"][readyState] ?? readyState}
              </span>
            </div>

            {/* roster ミニ表示（任意） */}
            {roster && (
              <div className="mt-2 text-xs text-emerald-700">
                RECORDER {roster.counts.recorder}/1, SHOOTER {roster.counts.shooter}/4
              </div>
            )}
          </header>

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
          <div className="mt-3 text-center">
            <button
              type="button"
              className="rounded-full px-6 py-2 text-white hover:opacity-80 transition-opacity"
              style={{ backgroundColor: '#2B578A' }}
            >
              編集
            </button>
          </div>

          {/* ナビゲーションボタン */}
          <section className="mt-6">
            <div className="grid grid-cols-3 gap-3">
              {/* 車内操作ボタン */}
              <button
                onClick={() => router.push('/recorder')}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#B6A98B' }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-xs" style={{ color: '#2B578A' }}>車内操作</span>
                </div>
              </button>

              {/* アルバムボタン */}
              <button
                onClick={() => router.push('/album')}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FCF98B' }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <span className="text-xs" style={{ color: '#2B578A' }}>アルバム</span>
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
                  <span className="text-xs" style={{ color: '#2B578A' }}>戻る</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
