'use client';

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWebSocket } from '@/app/lib/websocket';

export default function TestDisplay() {
  const searchParams = useSearchParams();
  const room = "test_room2";

  const [status, setStatus] = useState("WS: disconnected");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket: test_camera と同じルームで共有
  const roomId = room;
  const userId = `display_${Math.random().toString(36).slice(2, 10)}`;
  const { isConnected, lastMessage } = useWebSocket(roomId, userId);

  // WebSocketメッセージを受信したときの処理
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'photo') {
      setImageSrc(lastMessage.data);
      console.log('Received photo from WebSocket');
    }
  }, [lastMessage]);

  // 接続状態を更新
  useEffect(() => {
    setStatus(isConnected ? "WS: connected" : "WS: disconnected");
  }, [isConnected]);

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>test_display</h1>
      <p>Room: <strong>{room}</strong></p>
      <p>{status}</p>

      {imageSrc ? (
        <img src={imageSrc} alt="received" style={{ maxWidth: "100%", border: "1px solid #ddd" }} />
      ) : (
        <p>まだ画像が届いていません。カメラ側で撮影＆送信してください。</p>
      )}
    </main>
  );
}