// src/app/mic_camera/MicCameraClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import CameraPreview from "./components/CameraPreview";

// SpeechController はブラウザ専用依存(RecordRTC)を持つため、SSR無効で読み込み
const SpeechController = dynamic(() => import("./components/SpeechController"), { ssr: false });

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");

// ─────────────────────────────────────────────
// ここから下は「libを使わない」ための内蔵ヘルパ
// ─────────────────────────────────────────────

/** 環境変数 NEXT_PUBLIC_WS_URL が「オリジンのみ」の場合に /camera/ws を付与して URL を返す */
function buildCameraWsUrl(): URL | null {
  const raw = (process.env.NEXT_PUBLIC_WS_URL ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!u.pathname || u.pathname === "/") {
      u.pathname = "/camera/ws";
    }
    return u;
  } catch {
    return null; // 不正なURL
  }
}

/** ブラウザでのみ device_id を取得/生成（SSRでは呼ばない） */
function getDeviceIdClient(): string {
  const KEY = "device_uid_v1";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      const rnd =
        window.crypto && "randomUUID" in window.crypto
          ? window.crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      id = `dev_${rnd}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `dev_fallback_${Date.now().toString(36)}`;
  }
}

// ─────────────────────────────────────────────

export default function MicCameraClient() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("初期化中…");

  // SSR中に localStorage を触らないよう、マウント後に deviceId を取得
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setMyDeviceId(getDeviceIdClient());
    }
  }, []);

  // 認証 → room 決定 → WS 接続
  useEffect(() => {
    if (!myDeviceId) return; // deviceId 準備待ち
    let closed = false;

    async function boot() {
      try {
        const me = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : Promise.reject(r)));

        const r = `acc:${me.account_id}`;
        setRoom(r);

        const url = buildCameraWsUrl();
        if (!url) {
          setStatus("WS未設定（ローカルのみ動作）");
          return;
        }

        url.searchParams.set("room", r);
        url.searchParams.set("device_id", myDeviceId);

        const w = new WebSocket(url.toString());
        setWs(w);

        w.onopen = () => setStatus("WS接続: OK");
        w.onclose = () => !closed && setStatus("WS切断（ローカルは動作）");
        w.onerror = () => setStatus("WSエラー（ローカルは動作）");
      } catch {
        setStatus("未ログインです。/login からログインしてください。");
      }
    }

    boot();
    return () => {
      closed = true;
      setWs((prev) => {
        prev?.close();
        return null;
      });
    };
  }, [myDeviceId]);

  // 合言葉検知（SpeechController → 親）で実行する処理
  const onShutterDetected = () => {
    // 1) ローカル即時（同一タブ）
    window.dispatchEvent(new Event("mic-camera:take_photo"));
    // 2) WSブロードキャスト（同一roomの他端末へ）
    if (ws && ws.readyState === WebSocket.OPEN && room && myDeviceId) {
      ws.send(
        JSON.stringify({
          type: "take_photo",
          origin_device_id: myDeviceId,
          ts: Date.now(),
        })
      );
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="flex items-center gap-3 rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-rose-100">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-200 text-rose-800 shadow-inner">
            🎤
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-rose-800">
            Mic + Camera（統合）
          </h1>
          <div className="ml-auto text-sm text-rose-600">{status}</div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 左：カメラ */}
          <div className="rounded-2xl bg-white/70 p-4 shadow ring-1 ring-rose-100">
            <h2 className="mb-2 text-lg font-semibold text-rose-700">Camera</h2>
            {myDeviceId ? <CameraPreview ws={ws} myDeviceId={myDeviceId} /> : <div>準備中…</div>}
          </div>

          {/* 右：マイク */}
          <div className="rounded-2xl bg-white/70 p-4 shadow ring-1 ring-rose-100">
            <h2 className="mb-2 text-lg font-semibold text-rose-700">Speech</h2>
            <SpeechController apiBase={API_BASE} onShutterDetected={onShutterDetected} />
            <p className="mt-3 text-xs text-rose-500">
              合言葉「シャッター」で撮影。ローカル即時 + 同アカウント内端末にWS配信。
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
