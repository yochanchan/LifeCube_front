"use client";

import { useEffect, useRef, useState } from "react";

/* ---------- 型定義 ---------- */
type Msg = { id?: string; type: string; from: string; text?: string };
type WsStatus = "connecting" | "open" | "closed" | "error";

/* ---------- Main ---------- */
export default function Home() {
  /* 端末識別子 */
  const cid = useRef(`client-${Math.random().toString(36).slice(-4)}`);

  /* 接続 URL */
  const base = process.env.NEXT_PUBLIC_WS_URL;

  const wsURL = `${base}/ws_test/ws/${cid.current}`;

  /* React state */
  const [ws, setWs] = useState<WebSocket>();
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [log, setLog] = useState<Msg[]>([]);
  const [inp, setInp] = useState("");

  /* WebSocket を 1度だけ張る */
  useEffect(() => {
    if (ws) return;
    console.log("⏳ connecting to", wsURL);

    const socket = new WebSocket(wsURL);

    socket.onopen = () => {
      console.log("✅ socket open");
      setStatus("open");
      setErrorMsg(null);
    };
    socket.onclose = (e) => {
      console.log("🔌 socket closed", e.reason);
      setStatus("closed");
    };
    socket.onerror = (e) => {
      console.error("❌ socket error", e);
      setStatus("error");
      setErrorMsg("WebSocket error (see console for details)");
    };
    socket.onmessage = (e) => {
      const raw: Msg = JSON.parse(e.data);
      const m: Msg = raw.id ? raw : { ...raw, id: crypto.randomUUID() };

      setLog(prev => {
        if (m.type === "delete") {
          return prev.filter(x => x.id !== m.id);        // 削除要求
        }
        if (m.id && prev.some(x => x.id === m.id)) {
          return prev;                                   // 既にある → 追加しない
        }
        return [...prev, m];                             // 新規メッセージ
      });
    };

    setWs(socket);
  }, [ws, wsURL]);

  /* 送信ユーティリティ */
  const send = (type: Msg["type"], extra: Record<string, unknown> = {}) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ from: cid.current, type, ...extra }));
    } else {
      console.warn("⚠️  WebSocket not open – current readyState =", ws?.readyState);
      setErrorMsg("WebSocket not open; message not sent.");
    }
  };

  /* ステータス色 */
  const statusColor: Record<WsStatus, string> = {
    connecting: "orange",
    open: "green",
    closed: "gray",
    error: "red",
  };

  /* ---------- UI ---------- */
  return (
    <main
      style={{
        fontFamily: "sans-serif",
        maxWidth: 480,
        margin: "2rem auto",
      }}
    >
      {/* 接続ステータス */}
      <div
        style={{
          padding: "6px 12px",
          marginBottom: "1rem",
          borderRadius: 6,
          background: statusColor[status],
          color: "#fff",
        }}
      >
        Status: {status.toUpperCase()}
        {errorMsg && ` — ${errorMsg}`}
      </div>

      {/* URL とクライアント ID */}
      <p style={{ fontSize: 12, wordBreak: "break-all", marginTop: 0 }}>
        WS URL:&nbsp;{wsURL}
        <br />
        Your id:&nbsp;{cid.current}
      </p>

      {/* ボタン & フォーム */}
      <button onClick={() => send("poke")}>Poke 👆</button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (inp) send("chat", { text: inp });
          setInp("");
        }}
        style={{ marginTop: 8 }}
      >
        <input
          value={inp}
          onChange={(e) => setInp(e.target.value)}
          placeholder="Say hi…"
        />
        <button type="submit">Send</button>
      </form>

      {/* 受信ログ */}
      <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
        {log.map((m) => (
          <li key={m.id} style={{ margin: "4px 0" }}>
            <b>{m.from}</b>: {m.type === "poke" ? "👆" : m.text}
            <button
              onClick={() => m.id && send("delete", { id: m.id })}
              style={{ marginLeft: 4 }}
            >
              ❌
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}