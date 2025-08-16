// src/app/mic_camera/MicCameraClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CameraPreview from "./components/CameraPreview";
import SpeechController from "./components/SpeechController";
import { useRoomSocket } from "../../hooks/useRoomSocket";
import type { WsMessage } from "../../lib/ws";

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "";
const DEFAULT_REGION = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION ?? "japaneast";

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

type PhotoItem = {
  seq: number;
  device_id: string;
  image_url: string;
  pictured_at?: string;
};

// Join エラー文言の整形
function humanJoinError(reason: "invalid_role" | "recorder_full" | "shooter_full" | "not_connected" | "timeout"): string {
  switch (reason) {
    case "invalid_role":
      return "無効なロールです。";
    case "recorder_full":
      return "RECORDERの枠が埋まっています。";
    case "shooter_full":
      return "SHOOTERの枠が埋まっています。";
    case "not_connected":
      return "WebSocketが未接続です。";
    case "timeout":
      return "join応答がタイムアウトしました。";
    default:
      return "参加できませんでした。";
  }
}

export default function MicCameraClient() {
  const router = useRouter();

  // 認証関連
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const authReady = authChecked && !!me;

  // 画面状態
  const [status, setStatus] = useState("初期化中…");
  const [recActive, setRecActive] = useState(false);

  // 文字起こし
  const [liveText, setLiveText] = useState<string>("");
  const [finalLines, setFinalLines] = useState<{ text: string; ts: number }[]>([]);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // プレビュー（最新選択ロジック）
  const latestMapRef = useRef<Map<string, PhotoItem>>(new Map());
  const [preview, setPreview] = useState<PhotoItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 1200;

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
          router.replace(`/login?next=/mic_camera`);
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
    onMessage: (msg: WsMessage) => {
      // 1) take_photo → ローカルイベントで撮影
      if (msg?.type === "take_photo" && (msg as any).origin_device_id !== myDeviceId) {
        window.dispatchEvent(new Event("mic-camera:take_photo"));
      }
      // 2) photo_uploaded → 最新プレビュー候補を更新
      if (msg?.type === "photo_uploaded") {
        const m = msg as Extract<WsMessage, { type: "photo_uploaded" }>;
        const item: PhotoItem = {
          seq: m.seq,
          device_id: m.device_id,
          image_url: m.image_url,
          pictured_at: m.pictured_at,
        };
        const map = latestMapRef.current;
        const prev = map.get(item.device_id);
        if (!prev || item.seq > prev.seq) {
          map.set(item.device_id, item);
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const values = Array.from(map.values());
          // RECORDERポリシー：自分以外の最大 seq（なければ全体の最大）
          const others = values.filter((v) => v.device_id !== myDeviceId);
          const pickFrom = (others.length > 0 ? others : values).sort((a, b) => b.seq - a.seq);
          setPreview(pickFrom[0] ?? null);
        }, DEBOUNCE_MS);
      }
    },
  });

  // RECORDER として join（上限超過はメッセージ表示）
  useEffect(() => {
    if (!authReady || !room) return;
    if (readyState !== WebSocket.OPEN) return;
    if (joinedRole) return; // 既にjoin済み

    let disposed = false;
    (async () => {
      const res = await join("recorder");
      if (disposed) return;

      if ("reason" in res) {
        const msg = humanJoinError(res.reason);
        alert(msg);
        setStatus(`join_denied: ${res.reason}`);
        return;
      }
      setStatus("RECORDERとして参加しました");
    })();

    return () => {
      disposed = true;
    };
  }, [authReady, room, readyState, joinedRole, join]);

  // 撮影トリガ
  const broadcastTakePhoto = useCallback(() => {
    window.dispatchEvent(new Event("mic-camera:take_photo"));
    sendJson({ type: "take_photo", origin_device_id: myDeviceId, ts: Date.now() });
  }, [sendJson, myDeviceId]);

  // 文字起こしハンドラ
  const handleTranscript = useCallback((p: { text: string; isFinal: boolean; ts: number }) => {
    if (p.isFinal) {
      setLiveText("");
      setFinalLines((prev) => [...prev, { text: p.text, ts: p.ts }].slice(-20));
    } else {
      setLiveText(p.text);
    }
  }, []);

  const handleTrigger = useCallback(
    (p: { keyword: string; source: "interim" | "final"; text: string; ts: number }) => {
      broadcastTakePhoto();
      setTriggerMsg(`キーワード：「${p.keyword}」により撮影されました`);
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
      triggerTimerRef.current = setTimeout(() => setTriggerMsg(null), 4000);
    },
    [broadcastTakePhoto]
  );

  // タイマー類のクリーンアップ
  useEffect(() => {
    return () => {
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // プレビュー画像URL（フル画像）
  const imageSrc = preview
    ? preview.image_url.startsWith("/")
      ? `${API_BASE}${preview.image_url}`
      : preview.image_url
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50">
      {!authReady ? (
        <div className="mx-auto max-w-5xl p-4">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-rose-100 text-rose-700">{status}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-md p-4 space-y-4 sm:max-w-lg">
          <header className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-rose-100">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-rose-800">Mic &amp; Camera (RECORDER)</h1>
              <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                account_id: <strong>{me?.account_id}</strong>
              </span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                room_id: <strong>{room}</strong>
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRecActive((v) => !v)}
                disabled={!joinedRole}
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
              <span className="ml-auto text-xs text-rose-500">
                WS: {["CONNECTING", "OPEN", "CLOSING", "CLOSED"][readyState] ?? readyState}
              </span>
            </div>

            {/* roster ミニ表示（任意） */}
            {roster && (
              <div className="mt-2 text-xs text-rose-600">
                RECORDER {roster.counts.recorder}/1, SHOOTER {roster.counts.shooter}/4
              </div>
            )}
          </header>

          {triggerMsg && (
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800 ring-1 ring-emerald-100">{triggerMsg}</div>
          )}

          {/* 上：カメラ */}
          <section aria-label="カメラ" className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-rose-100">
            <CameraPreview apiBase={API_BASE} wsRef={wsRef} myDeviceId={myDeviceId} sendJson={sendJson} />
          </section>

          {/* 中：文字起こし */}
          <section aria-label="文字起こし" className="rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-rose-100">
            <h2 className="text-sm font-semibold text-rose-700">文字起こし（リアルタイム）</h2>
            <div className="mt-2 min-h-[44px] rounded-lg bg-rose-50 px-3 py-2 text-rose-800">
              {liveText ? liveText : <span className="text-rose-400">（発話待機中）</span>}
            </div>
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

          {/* 下：直近の写真プレビュー（フル画像） */}
          <section aria-label="直近の写真プレビュー" className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-rose-100">
            <h2 className="text-sm font-semibold text-rose-700">直近の写真プレビュー</h2>
            {!preview ? (
              <div className="mt-2 rounded-lg bg-rose-50 p-3 text-rose-400">（まだ写真がありません）</div>
            ) : (
              <figure className="mt-2 overflow-hidden rounded-xl bg-white ring-1 ring-rose-100">
                <img
                  src={imageSrc!}
                  alt={preview.pictured_at ?? `seq=${preview.seq}`}
                  className="block max-h-96 w-full bg-black/5 object-contain"
                  loading="eager"
                  decoding="async"
                />
                <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-rose-700">
                  <span className="truncate">seq: {preview.seq}</span>
                  <span className="rounded bg-rose-50 px-2 py-0.5">{preview.device_id}</span>
                </figcaption>
              </figure>
            )}
          </section>

          {/* 録音エンジン（UIなし） */}
          <SpeechController
            apiBase={API_BASE}
            defaultRegion={DEFAULT_REGION}
            active={recActive}
            onTranscript={handleTranscript}
            onTrigger={handleTrigger}
            onStatusChange={(s, d) => console.log("[Speech]", s, d ?? "")}
            cooldownMs={5000}
          />
        </div>
      )}
    </main>
  );
}
