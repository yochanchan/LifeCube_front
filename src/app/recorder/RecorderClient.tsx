// src/app/recorder/RecorderClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CameraPreview from "../components/CameraPreview";
import SpeechController from "../components/SpeechController";
import LatestPreview from "../components/LatestPreview";
import { useRoomSocket } from "../../hooks/useRoomSocket";
import type { WsMessage } from "../../lib/ws";
import { apiclient } from "@/lib/apiclient";

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
  const [lastKeyword, setLastKeyword] = useState<string | null>(null);
  const triggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myDeviceId = useMemo(getOrCreateDeviceId, []);
  const room = me ? `acc:${me.account_id}` : null;

  // ─────────────────────────────────────
  // 認証チェック（JWT対応：apiclient 経由に統一）
  // ─────────────────────────────────────
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
        window.dispatchEvent(new Event("app:take_photo"));
      }
      // photo_uploaded の最新選定は LatestPreview 側で処理
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

  // “撮影要求のブロードキャスト”
  const broadcastTakePhoto = useCallback(() => {
    // 自分も撮影
    window.dispatchEvent(new Event("app:take_photo"));
    // 他端末へ通知
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
      setLastKeyword(p.keyword);
      setTriggerMsg(`キーワード：「${p.keyword}」により撮影されました`);
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
      triggerTimerRef.current = setTimeout(() => setTriggerMsg(null), 2000);
    },
    [broadcastTakePhoto]
  );

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

  // タイマー類のクリーンアップ
  useEffect(() => {
    return () => {
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
    };
  }, []);

  // アップロードトーストの表示/非表示イベントに同期して、キーワードトーストも同時に閉じる
  useEffect(() => {
    const onUploadToastStarted = (e: Event) => {
      const detail = (e as CustomEvent).detail as { duration?: number } | undefined;
      const duration = detail?.duration ?? 2000;
      if (triggerTimerRef.current) clearTimeout(triggerTimerRef.current);
      triggerTimerRef.current = setTimeout(() => setTriggerMsg(null), duration);
    };
    const onUploadToastEnded = () => setTriggerMsg(null);
    window.addEventListener("camera:upload_toast_started", onUploadToastStarted as EventListener);
    window.addEventListener("camera:upload_toast_ended", onUploadToastEnded);
    return () => {
      window.removeEventListener("camera:upload_toast_started", onUploadToastStarted as EventListener);
      window.removeEventListener("camera:upload_toast_ended", onUploadToastEnded);
    };
  }, []);

  const rosterText =
    roster && `RECORDER ${roster.counts.recorder}/1, SHOOTER ${roster.counts.shooter}/4`;

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#BDD9D7" }}>
      {!authReady ? (
        <div className="mx-auto max-w-5xl p-4">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-rose-100" style={{ color: "#2B578A" }}>
            {status}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-md p-4 space-y-4 sm:max-w-lg">
          {/* ヘッダ */}
          <header className="p-4">
            <div className="flex justify-center items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#2B578A' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5a6.5 6.5 0 006.5-6.5v-4a6.5 6.5 0 00-13 0v4a6.5 6.5 0 006.5 6.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5v3" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 22h8" />
              </svg>
              <h1 className="text-xl" style={{ color: "#2B578A" }}>
                車内カメラ
              </h1>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#2B578A' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5a6.5 6.5 0 006.5-6.5v-4a6.5 6.5 0 00-13 0v4a6.5 6.5 0 006.5 6.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5v3" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 22h8" />
              </svg>
            </div>

            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setRecActive((v) => !v)}
                disabled={!joinedRole}
                className={
                  "rounded-full px-8 py-4 text-lg font-semibold text-white transition " +
                  (recActive ? "hover:opacity-80" : "hover:opacity-80")
                }
                style={{ backgroundColor: "#2B578A" }}
                aria-pressed={recActive}
                title={recActive ? "録音停止" : "録音開始"}
              >
                {recActive ? "■ 録音停止" : "▶ HONDAカメラ始動"}
              </button>
            </div>
          </header>

          {/* 情報表示（カメラカードの上に表示） */}
          <div className="text-[10px] text-right" style={{ color: "#2B578A" }}>
            <div>
              ID:{me?.account_id} Room:{room} {rosterText && rosterText}
            </div>
          </div>

          {/* 上：カメラ */}
          <section aria-label="カメラ" className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-rose-100">
            <CameraPreview apiBase={API_BASE} wsRef={wsRef} myDeviceId={myDeviceId} sendJson={sendJson}>
              {/* 文字起こし部分 */}
              <div className="rounded-2xl bg-white/80 p-3 shadow-sm ring-1 ring-rose-100">
                <h2 className="text-sm" style={{ color: "#2B578A" }}>
                  文字起こし（リアルタイム）
                </h2>
                <div className="mt-2 min-h-[44px] rounded-lg px-3 py-2" style={{ backgroundColor: "#EEFAF9", color: "#2B578A" }}>
                  {liveText ? liveText : <span style={{ color: "#2B578A" }}>（発話待機中）</span>}
                </div>
                <div className="mt-3 max-h-60 overflow-y-auto rounded-lg ring-1" style={{ backgroundColor: "#EEFAF9" }}>
                  {finalLines.length === 0 ? (
                    <div className="p-3 text-sm" style={{ color: "#2B578A" }}>
                      （確定テキストはまだありません）
                    </div>
                  ) : (
                    <ul className="divide-y divide-rose-100">
                      {finalLines.map((l, i) => (
                        <li key={l.ts + ":" + i} className="p-3 text-sm" style={{ color: "#2B578A" }}>
                          {new Date(l.ts).toLocaleTimeString()}：{l.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CameraPreview>
          </section>

          {/* キーワードで撮影した通知（任意） */}
          {triggerMsg && (
            <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100" style={{ color: "#2B578A" }}>
              {triggerMsg}
            </div>
          )}

          {/* 下：直近の写真プレビュー（RECORDERポリシー） */}
          <section aria-label="直近の写真プレビュー" className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-rose-100">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm" style={{ color: "#2B578A" }}>
                直近の写真プレビュー
              </h2>
              {lastKeyword && (
                <div className="text-xs" style={{ color: "#2B578A" }}>
                  キーワード：「{lastKeyword}」
                </div>
              )}
            </div>
            <LatestPreview
              apiBase={API_BASE}
              wsRef={wsRef}
              policy="recorder"
              myDeviceId={myDeviceId}
              debounceMs={1200}
              wsReady={readyState}
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

          {/* ナビゲーションボタン */}
          <section className="mt-6">
            <div className="grid grid-cols-4 gap-3">
              {/* 車外カメラボタン */}
              <button
                onClick={() => router.push("/shooter")}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                                     <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#5BD3CB" }}>
                     <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                     </svg>
                   </div>
                  <span className="text-[10px]" style={{ color: "#2B578A" }}>
                    車外カメラ
                  </span>
                </div>
              </button>

              {/* アルバムボタン */}
               <button
                 onClick={() => router.push("/album")}
                 className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
               >
                 <div className="flex flex-col items-center justify-center gap-2">
                   <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FCF98B" }}>
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#B6A98B" }}>
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                     </svg>
                   </div>
                   <span className="text-[10px]" style={{ color: "#2B578A" }}>
                     アルバム
                   </span>
                 </div>
               </button>

              {/* 戻るボタン */}
              <button
                onClick={() => router.push("/room")}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#2B578A" }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </div>
                  <span className="text-[10px]" style={{ color: "#2B578A" }}>
                    トップに戻る
                  </span>
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
