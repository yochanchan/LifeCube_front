// src/hooks/useRoomSocket.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildWsUrl, safeSend, type WsMessage } from "../lib/ws";

type Options = {
  base: string;                 // 例: ws://localhost:8000  /  wss://example.com/ws（パス省略可）
  room: string | null;          // 例: acc:1
  deviceId: string;             // ローカルストレージ由来の device_id
  onMessage?: (msg: WsMessage, ev: MessageEvent) => void;
  autoReconnect?: boolean;      // 既定: true
  pingIntervalMs?: number;      // 既定: 25000
};

export type JoinResult =
  | { ok: true; role: "recorder" | "shooter"; limits: { recorder_max: number; shooter_max: number } }
  | { ok: false; reason: "invalid_role" | "recorder_full" | "shooter_full" | "not_connected" | "timeout" };

export type RosterState = {
  recorder: string | null;
  shooters: string[];
  counts: { recorder: number; shooter: number };
};

const DEFAULT_BACKOFF = [1000, 2000, 5000, 10000, 15000]; // ms
const JITTER = 0.25; // ±25%

export function useRoomSocket({
  base,
  room,
  deviceId,
  onMessage,
  autoReconnect = true,
  pingIntervalMs = 25_000,
}: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const [readyState, setReadyState] = useState<WebSocket["readyState"]>(WebSocket.CLOSED);

  // 最新の onMessage を ref で保持（依存に入れない）
  const onMessageRef = useRef<Options["onMessage"]>(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // join 状態
  const [joinedRole, setJoinedRole] = useState<"recorder" | "shooter" | null>(null);
  const [roster, setRoster] = useState<RosterState | null>(null);

  // 直近の join 要求を覚えて、再接続後に re-join する
  const lastJoinRoleRef = useRef<"recorder" | "shooter" | null>(null);

  // join 結果待ち（1件だけ扱う）
  const joinWaiterRef = useRef<{
    resolve?: (v: JoinResult) => void;
    timeoutId?: ReturnType<typeof setTimeout>;
  }>({});

  // 再接続バックオフ・停止フラグ・心拍
  const retryRef = useRef(0);
  const stopRef = useRef(false);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPing = () => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  };

  const startPing = () => {
    clearPing();
    if (!pingIntervalMs) return;
    pingTimerRef.current = setInterval(() => {
      safeSend(wsRef.current, { type: "ping" });
    }, pingIntervalMs);
  };

  // join 結果待ちを安全に解放
  const settleJoin = (res: JoinResult) => {
    if (joinWaiterRef.current.timeoutId) {
      clearTimeout(joinWaiterRef.current.timeoutId);
    }
    joinWaiterRef.current.timeoutId = undefined;
    const fn = joinWaiterRef.current.resolve;
    joinWaiterRef.current.resolve = undefined;
    if (fn) fn(res);
  };

  const scheduleReconnect = (connectFn: () => void) => {
    if (!autoReconnect || stopRef.current) return;
    retryRef.current = Math.min(retryRef.current + 1, DEFAULT_BACKOFF.length);
    const baseDelay = DEFAULT_BACKOFF[retryRef.current - 1] ?? DEFAULT_BACKOFF[DEFAULT_BACKOFF.length - 1];
    const jitter = baseDelay * (Math.random() * 2 * JITTER - JITTER);
    const delay = Math.max(300, Math.floor(baseDelay + jitter));
    setTimeout(() => {
      if (!stopRef.current) connectFn();
    }, delay);
  };

  const connect = useCallback(() => {
    if (!room) return;

    // 既存接続を明示的に閉じる（idempotent）
    try {
      wsRef.current?.close();
    } catch {
      /* noop */
    }
    wsRef.current = null;

    const url = buildWsUrl(base, room, deviceId);
    const ws = new WebSocket(url.toString());
    wsRef.current = ws;
    setReadyState(ws.readyState); // CONNECTING

    ws.onopen = () => {
      retryRef.current = 0; // backoff リセット
      setReadyState(ws.readyState); // OPEN
      startPing();

      // 再接続後に前回の join を再送
      if (lastJoinRoleRef.current) {
        safeSend(wsRef.current, { type: "join", role: lastJoinRoleRef.current, device_id: deviceId });
      }
    };

    ws.onmessage = (ev) => {
      let parsed: any;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return; // 非JSONは無視
      }

      // 内部処理（join/roster 等）
      switch (parsed?.type) {
        case "join_ok":
          setJoinedRole(parsed.role);
          settleJoin({ ok: true, role: parsed.role, limits: parsed.limits });
          break;
        case "join_denied":
          setJoinedRole(null);
          settleJoin({ ok: false, reason: parsed.reason });
          break;
        case "roster_update":
          setRoster({
            recorder: parsed.recorder ?? null,
            shooters: Array.isArray(parsed.shooters) ? parsed.shooters : [],
            counts: parsed.counts ?? { recorder: 0, shooter: 0 },
          });
          break;
        case "pong":
          // noop
          break;
        default:
          break;
      }

      // 外部 onMessage へ転送（最後に呼ぶ）
      onMessageRef.current?.(parsed as WsMessage, ev);
    };

    ws.onerror = () => {
      // 詳細は onclose 側で一括処理
    };

    ws.onclose = () => {
      clearPing();
      setReadyState(ws.readyState); // CLOSED
      wsRef.current = null;
      setJoinedRole(null);

      // ぶら下がっている join を not_connected で落とす
      if (joinWaiterRef.current.resolve) {
        settleJoin({ ok: false, reason: "not_connected" });
      }

      // 自動再接続
      scheduleReconnect(connect);
    };
  }, [base, room, deviceId, autoReconnect, pingIntervalMs]); // onMessage は依存に入れない

  // 接続ライフサイクル（room が変わった時のみ貼り直す）
  useEffect(() => {
    if (!room) return;
    stopRef.current = false;
    connect();

    return () => {
      stopRef.current = true;
      clearPing();
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
      setReadyState(WebSocket.CLOSED);
      setJoinedRole(null);
      // ぶら下がっている join をクリア
      if (joinWaiterRef.current.resolve) {
        settleJoin({ ok: false, reason: "not_connected" });
      }
    };
  }, [room, connect]);

  const sendJson = useCallback((data: unknown) => {
    return safeSend(wsRef.current, data);
  }, []);

  const join = useCallback(
    (role: "recorder" | "shooter", timeoutMs = 5000): Promise<JoinResult> => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return Promise.resolve({ ok: false, reason: "not_connected" });
      }
      lastJoinRoleRef.current = role; // 再接続時の re-join 用に記憶

      // 既存の待機があればタイムアウト扱いで落としてから上書き（リーク防止）
      if (joinWaiterRef.current.resolve) {
        settleJoin({ ok: false, reason: "timeout" });
      }

      return new Promise<JoinResult>((resolve) => {
        const timeoutId = setTimeout(() => {
          // 応答なし
          if (joinWaiterRef.current.resolve === resolve) {
            joinWaiterRef.current.resolve = undefined;
            joinWaiterRef.current.timeoutId = undefined;
          }
          resolve({ ok: false, reason: "timeout" });
        }, timeoutMs);

        joinWaiterRef.current.resolve = resolve;
        joinWaiterRef.current.timeoutId = timeoutId;

        // device_id はサーバ側で上書きされるが一応添付（診断用）
        sendJson({ type: "join", role, device_id: deviceId });
      });
    },
    [deviceId, sendJson]
  );

  return { wsRef, readyState, sendJson, join, joinedRole, roster };
}
