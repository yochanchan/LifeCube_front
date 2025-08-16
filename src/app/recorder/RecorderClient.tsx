// src/app/recorder/RecorderClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CameraPreview from "../mic_camera/components/CameraPreview";
import SpeechController from "../mic_camera/components/SpeechController";
import LatestPreview from "../components/LatestPreview";
import { useRoomSocket } from "../../hooks/useRoomSocket";
import type { WsMessage } from "../../lib/ws";

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "";

type Me = { account_id: number; email: string; role: string };

// Join エラー文言の整形（MicCamera と同じ）
function humanJoinError(
  reason: "invalid_role" | "recorder_full" | "shooter_full" | "not_connected" | "timeout"
): string {
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

export default function RecorderClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const authReady = authChecked && !!me;

  const [status, setStatus] = useState("初期化中…");
  const [recActive, setRecActive] = useState(false);

  // 文字起こしの状態（MicCamera と同等）
  const [liveText, setLiveText] = useState<string>("");
  const [finalLines, setFinalLines] = useState<{ text: string; ts: number }[]>([]);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);
  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          router.replace(`/login?next=/recorder`);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // WS 接続 + メッセージ処理（take_photo はローカル撮影トリガに使用）
  const { wsRef, readyState, sendJson, join, joinedRole, roster } = useRoomSocket({
    base: WS_BASE,
    room,
    deviceId: myDeviceId,
    pingIntervalMs: 5000,
    onMessage: (msg: WsMessage) => {
      if (msg?.type === "take_photo" && (msg as any).origin_device_id !== myDeviceId) {
        window.dispatchEvent(new Event("mic-camera:take_photo"));
      }
      // photo_uploaded の最新選定は LatestPreview 側で処理するため、ここでは何もしない
    },
  });

  // RECORDER として join
  useEffect(() => {
    if (!authReady || !room) return;
    if (readyState !== WebSocket.OPEN) return;
    if (joinedRole) return;

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

  // “撮影要求のブロードキャスト”（音声キーワード検出時に送信）
  const broadcastTakePhoto = useCallback(() => {
    // 自分も撮影
    window.dispatchEvent(new Event("mic-camera:take_photo"));
    // 他端末へ“撮影して”を通知
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
    };
  }, []);

  const rosterText =
    roster && `RECORDER ${roster.counts.recorder}/1, SHOOTER ${roster.counts.shooter}/4`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50">
      {!authReady ? (
        <div className="mx-auto max-w-5xl p-4">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-rose-100 text-rose-700">{status}</div>
        </div>
      ) : (
        <div className="mx-auto max-w-md p-4 space-y-4 sm:max-w-lg">
          {/* ヘッダ */}
          <header className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-rose-100">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-rose-800">Recorder</h1>
              <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                account_id: <strong>{me?.account_id}</strong>
              </span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
                room: <strong>{room}</strong>
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

            {rosterText && <div className="mt-2 text-xs text-rose-600">{rosterText}</div>}
          </header>

          {/* 上：カメラ */}
          <section aria-label="カメラ" className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-rose-100">
            <CameraPreview apiBase={API_BASE} wsRef={wsRef} myDeviceId={myDeviceId} sendJson={sendJson} />
          </section>

          {/* 中：文字起こし（← ここを“カメラとプレビューの間”に配置） */}
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

          {/* キーワードで撮影した通知（任意） */}
          {triggerMsg && (
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800 ring-1 ring-emerald-100">{triggerMsg}</div>
          )}

          {/* 下：直近の写真プレビュー（RECORDERポリシー = “自分以外を優先し、seq最大”） */}
          <section
            aria-label="直近の写真プレビュー"
            className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-rose-100"
          >
            <h2 className="text-sm font-semibold text-rose-700">直近の写真プレビュー</h2>
            <LatestPreview
              apiBase={API_BASE}
              wsRef={wsRef}
              policy="recorder"
              myDeviceId={myDeviceId}
              debounceMs={1200}
            />
          </section>

          {/* 録音エンジン（UIなし） */}
          <SpeechController
            apiBase={API_BASE}
            defaultRegion={process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION ?? "japaneast"}
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
