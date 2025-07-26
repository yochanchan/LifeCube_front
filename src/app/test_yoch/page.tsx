"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { id?: string; type: string; from: string; text?: string };

export default function Home() {
  // 端末識別子
  const cid = useRef(`client-${Math.random().toString(36).slice(-4)}`);

  // 状態
  const [ws, setWs] = useState<WebSocket>();
  const [log, setLog] = useState<Msg[]>([]);
  const [inp, setInp] = useState("");

  // WebSocket を 1 度だけ張る（StrictMode 二重実行防止）
  useEffect(() => {
    if (ws) return;

    const socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}/ws_test/ws/${cid.current}`
    );

    socket.onopen = () => console.log("socket open");
    socket.onclose = () => console.log("socket closed");

    socket.onmessage = (e) => {
      const raw: Msg = JSON.parse(e.data);

      // --- ★ id が無いパケットはここで付与 ------------------
      const m: Msg = raw.id
        ? raw
        : { ...raw, id: crypto.randomUUID() };
      // ----------------------------------------------------

      setLog((prev) =>
        m.type === "delete"
          ? prev.filter((x) => x.id !== m.id) // 削除指示
          : [...prev, m]                      // 追加
      );
    };

    setWs(socket);
  }, [ws]);

  // 送信ユーティリティ
  const send = (type: Msg["type"], extra: Record<string, unknown> = {}) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ from: cid.current, type, ...extra }));
    }
  };

  // 画面
  return (
    <main
      style={{
        fontFamily: "sans-serif",
        maxWidth: 480,
        margin: "2rem auto",
      }}
    >
      <h2>Your id: {cid.current}</h2>

      <button onClick={() => send("poke")}>Poke 👆</button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (inp) send("chat", { text: inp });
          setInp("");
        }}
      >
        <input
          value={inp}
          onChange={(e) => setInp(e.target.value)}
          placeholder="Say hi…"
        />
        <button type="submit">Send</button>
      </form>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {log.map((m) => (
          <li key={m.id} style={{ margin: "4px 0" }}>
            <b>{m.from}</b>: {m.type === "poke" ? "👆" : m.text}
            <button onClick={() => m.id && send("delete", { id: m.id })}>
              ❌
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
