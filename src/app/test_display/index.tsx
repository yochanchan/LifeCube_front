'use client';

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [room, setRoom] = useState("test_room2");

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Realtime Photo Share</h1>
      <p>同じ <code>room</code> を入力した人同士で写真が共有されます。</p>

      <label>
        Room ID: {" "}
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="例: family1"
          style={{ padding: "0.5rem", marginLeft: 8 }}
        />
      </label>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Link href={{ pathname: "/test_camera", query: { room } }}>
          <button style={{ padding: "0.75rem 1rem" }}>test_camera</button>
        </Link>
        <Link href={{ pathname: "/test_display", query: { room } }}>
          <button style={{ padding: "0.75rem 1rem" }}>test_display</button>
        </Link>
      </div>

      <p style={{ marginTop: 24 }}>
        別のスマホで <strong>同じ Room</strong> を指定して <em>test_display</em> を開けばリアルタイム表示されます。
      </p>
    </main>
  );
}

function makeWsUrl(room: string) {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname;
  // FastAPIをローカル8000番で動かす前提。ポートやドメインを変える場合はここを編集。
  return `${protocol}://${host}:8000/ws/${encodeURIComponent(room)}`;
}
