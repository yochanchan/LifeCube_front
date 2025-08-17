// src/app/shooter/ShooterClient.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CameraPreview from "../components/CameraPreview";
import { useRoomSocket } from "../../hooks/useRoomSocket";
import LatestPreview from "../components/LatestPreview";

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
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("not authenticated");
        const j = (await res.json()) as Me;
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
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50">
      {!authReady ? (
        <div className="mx-auto max-w-5xl p-4">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-rose-100 text-rose-700">{status}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-md p-4 space-y-4 sm:max-w-lg">
          <header className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-emerald-100">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-emerald-800">Shooter</h1>
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
                className="rounded-full bg-emerald-500 px-4 py-2 text-white hover:bg-emerald-600"
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
        </div>
      )}
    </main>
  );
}
