// src/app/mic_camera/MicCameraClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CameraPreview from "./components/CameraPreview";
import SpeechController from "./components/SpeechController";

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "";
const DEFAULT_REGION = "japaneast";

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

export default function MicCameraClient() {
  const router = useRouter();

  // Hooks（順序不変）
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [status, setStatus] = useState("初期化中…");
  const [recActive, setRecActive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const [liveText, setLiveText] = useState<string>(""); // interim
  const [finalLines, setFinalLines] = useState<{ text: string; ts: number }[]>([]); // final履歴
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null); // バナー表示用
  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myDeviceId = useMemo(getOrCreateDeviceId, []);
  const room = me ? `acc:${me.account_id}` : null;
  const authReady = authChecked && !!me;

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
          router.replace(`/login?next=/mic_camera`);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // WS 接続
  useEffect(() => {
    if (!authReady || !room || !WS_BASE) return;
    const raw = WS_BASE;                // 例: ws://localhost:8000
    const url = new URL(raw);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/camera/ws";      // パスが無い/ルートなら補正
    }
    url.searchParams.set("room", room);
    url.searchParams.set("device_id", myDeviceId);

    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    ws.onopen = () => console.log("[mic_camera] WS connected:", room);
    ws.onerror = (e) => console.warn("[mic_camera] WS error:", e);
    ws.onclose = () => console.warn("[mic_camera] WS closed");

    return () => {
      try { ws.close(); } catch { }
      wsRef.current = null;
    };
  }, [authReady, room, myDeviceId]);

  // 発火：ローカル + WS
  const broadcastTakePhoto = useCallback(() => {
    window.dispatchEvent(new Event("mic-camera:take_photo"));
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "take_photo", origin_device_id: myDeviceId, ts: Date.now() }));
    }
  }, [myDeviceId]);

  // 文字起こし/発火の受け口
  const handleTranscript = useCallback((p: { text: string; isFinal: boolean; ts: number }) => {
    if (p.isFinal) {
      setLiveText("");
      setFinalLines(prev => {
        const next = [...prev, { text: p.text, ts: p.ts }];
        return next.slice(-20); // 直近20行に制限
      });
    } else {
      setLiveText(p.text);
    }
  }, []);

  const handleTrigger = useCallback((p: { keyword: string; source: "interim" | "final"; text: string; ts: number }) => {
    broadcastTakePhoto();
    // バナー表示
    setTriggerMsg(`キーワード：「${p.keyword}」により撮影されました`);
    if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
    triggerTimerRef.current = setTimeout(() => setTriggerMsg(null), 4000);
  }, [broadcastTakePhoto]);

  // アンマウント時にタイマークリア
  useEffect(() => {
    return () => {
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
    };
  }, []);

  // レイアウト：スマホ前提で縦並び（上：カメラ / 下：テキスト）
  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50">
      {!authReady ? (
        <div className="mx-auto max-w-5xl p-4">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-rose-100 text-rose-700">
            {status}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-md p-4 space-y-4 sm:max-w-lg">
          {/* ヘッダー */}
          <header className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-rose-100">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-rose-800">Mic &amp; Camera</h1>
              <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                account_id: <strong>{me!.account_id}</strong>
              </span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                room_id: <strong>{room}</strong>
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRecActive(v => !v)}
                className={
                  "rounded-full px-4 py-2 text-white transition " +
                  (recActive ? "bg-rose-600 hover:bg-rose-700" : "bg-rose-500 hover:bg-rose-600")
                }
                aria-pressed={recActive}
                title={recActive ? "録音停止" : "録音開始"}
              >
                {recActive ? "■ 録音停止" : "▶ 録音開始"}
              </button>
              <p className="text-sm text-rose-600">{status}</p>
            </div>
          </header>

          {/* バナー（トリガー通知） */}
          {triggerMsg && (
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800 ring-1 ring-emerald-100">
              {triggerMsg}
            </div>
          )}

          {/* 上：カメラ */}
          <section aria-label="カメラ" className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-rose-100">
            <CameraPreview apiBase={API_BASE} wsRef={wsRef} myDeviceId={myDeviceId} />
          </section>

          {/* 下：文字起こし＋結果 */}
          <section aria-label="文字起こし" className="rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-rose-100">
            <h2 className="text-sm font-semibold text-rose-700">文字起こし（リアルタイム）</h2>

            {/* interim ライブ表示 */}
            <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-800 min-h-[44px]">
              {liveText ? liveText : <span className="text-rose-400">（発話待機中）</span>}
            </div>

            {/* final 履歴 */}
            <div className="mt-3 max-h-60 overflow-y-auto rounded-lg bg-white ring-1 ring-rose-100">
              {finalLines.length === 0 ? (
                <div className="p-3 text-sm text-rose-400">（確定テキストはまだありません）</div>
              ) : (
                <ul className="divide-y divide-rose-100">
                  {finalLines.map((l, i) => (
                    <li key={l.ts + ":" + i} className="p-3 text-sm text-rose-800">
                      {new Date(l.ts).toLocaleTimeString()}：{l.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Speech コントローラ（UIなし） */}
          <SpeechController
            apiBase={API_BASE}
            defaultRegion={DEFAULT_REGION}
            active={recActive}
            onTranscript={handleTranscript}
            onTrigger={handleTrigger}
            onStatusChange={(s, d) => console.log("[Speech]", s, d ?? "")}
            cooldownMs={5000} // PoC要件：送信側クールダウン5秒
          />
        </div>
      )}
    </main>
  );
}
