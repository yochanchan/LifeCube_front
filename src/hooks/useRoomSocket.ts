// src/hooks/useRoomSocket.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildWsUrl, safeSend, type WsMessage } from "../lib/ws";

type Opts = {
  base: string;                   // NEXT_PUBLIC_WS_URL（パス無し想定でもOK）
  room: string | null;            // acc:<id>
  deviceId: string;
  onMessage?: (msg: WsMessage, ev: MessageEvent) => void;
  autoReconnect?: boolean;
};

// 参照用の明示的な型
type OnMessageCb = (msg: WsMessage, ev: MessageEvent) => void;

export function useRoomSocket({ base, room, deviceId, onMessage, autoReconnect = true }: Opts) {
  const wsRef = useRef<WebSocket | null>(null);
  const [readyState, setReadyState] = useState<WebSocket["readyState"]>(WebSocket.CLOSED);
  const retryRef = useRef(0);
  const stopRef = useRef(false);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ★ onMessage は ref に保持（親の再レンダーで connect を揺らさない）
  const onMessageRef = useRef<OnMessageCb | null>(null);
  useEffect(() => {
    onMessageRef.current = onMessage ?? null;
  }, [onMessage]);

  const clearPing = () => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  };

  // ★ connect は onMessage に依存しない（安定化）
  const connect = useCallback(() => {
    if (!room) return;

    // 既存があれば閉じる（StrictMode 二重実行にも idempotent）
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
      retryRef.current = 0;
      setReadyState(ws.readyState); // OPEN
      clearPing();
      // 心拍（25s）
      pingTimerRef.current = setInterval(() => {
        safeSend(wsRef.current, { type: "ping" });
      }, 25_000);
    };

    ws.onmessage = (ev) => {
      // 状態更新は onopen/onclose だけで十分
      const cb = onMessageRef.current;
      if (!cb) return;
      try {
        const msg = JSON.parse(ev.data);
        cb(msg as WsMessage, ev);
      } catch {
        // 非JSONは無視
      }
    };

    ws.onerror = () => {
      // noop: onclose で扱う
    };

    ws.onclose = () => {
      clearPing();
      setReadyState(ws.readyState); // CLOSED
      wsRef.current = null;
      if (!autoReconnect || stopRef.current) return;

      retryRef.current = Math.min(retryRef.current + 1, 5);
      const delay = [1000, 2000, 5000, 10000, 15000][retryRef.current - 1] ?? 15000;
      setTimeout(() => {
        if (!stopRef.current) connect();
      }, delay);
    };
  }, [base, room, deviceId, autoReconnect]);

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
    };
  }, [room, connect]);

  const sendJson = useCallback((msg: WsMessage) => {
    return safeSend(wsRef.current, msg);
  }, []);

  return { wsRef, readyState, sendJson };
}
