'use client';
import { useEffect, useRef, useState } from 'react';

export function useCamera(
  constraints: MediaStreamConstraints = { video: true }
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  /** ストリーム取得は一度だけにする。開発用ではuseEffectが2回走ってしまうことへの対処 */
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (canceled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        setStream(s); // ← video まだ null でも OK
      } catch (e) {
        console.error('getUserMedia failed', e);
      }
    })();
    return () => {
      canceled = true;
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← StrictMode で 2 回呼ばれても OK

  /** ② video が準備できた時点で srcObject を張る */
  useEffect(() => {
    if (!stream || !videoRef.current) return;
    const v = videoRef.current;
    v.srcObject = stream;

    const handleLoaded = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    };
    v.addEventListener('loadedmetadata', handleLoaded);

    v.play().catch(console.error);

    return () => v.removeEventListener('loadedmetadata', handleLoaded);
  }, [stream]);

  /** ③ スナップショット */
  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return null;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };

  return { videoRef, canvasRef, capture, stream };
}

//沢田つけたし
import { useRouter } from "next/router";

  export default function TestCamera() {
    // Next.js のルーターを使って URL パラメータから room を取得
    const router = useRouter();
    const room = (router.query.room as string) || "demo"; // デフォルトは "demo"
      // WebSocket 接続の参照を保持するための useRef（再レンダリングしても接続は保持）
  const wsRef = useRef<WebSocket | null>(null);
  // プレビュー画像の Base64 データを保持
  const [preview, setPreview] = useState<string | null>(null);
  // WebSocket の接続状態を表示するためのステート
  const [status, setStatus] = useState("WS: disconnected");
  function makeWsUrl(room: string) {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname;
    return `${protocol}://${host}:8000/ws/${encodeURIComponent(room)}`;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = makeWsUrl(room);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus("WS: connected");
    ws.onclose = () => setStatus("WS: disconnected");
    ws.onerror = () => setStatus("WS: error");

    // 受信側の処理は不要（このページは送信専用）。

    return () => ws.close();
  }, [room]);

  // スマホで確実にカメラUIを出すなら file input + capture が簡単
  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string; // 例: data:image/jpeg;base64,....
      setPreview(dataUrl);
      // WebSocket送信
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "image", data: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>test_camera</h1>
      <p>Room: <strong>{room}</strong></p>
      <p>{status}</p>

      <label style={{ display: "block", marginTop: 16 }}>
        写真を撮る / 選ぶ：
        <input
          type="file"
          accept="image/*"
          capture="environment"  // 背面カメラ推奨（端末依存）
          onChange={onFileChange}
          style={{ display: "block", marginTop: 8 }}
        />
      </label>

      {preview && (
        <div style={{ marginTop: 16 }}>
          <p>送信プレビュー：</p>
          <img src={preview} alt="preview" style={{ maxWidth: "100%" }} />
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: 14, color: "#555" }}>
        ※ より高度には <code>getUserMedia()</code> で連続フレームを送ることも可能ですが、まずは静止画で仕組み確認するのがおすすめです。
      </p>
    </main>
  );
}
//沢田つけたし

//沢田つけたし
function makeWsUrl(room: string) {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname;
  // FastAPIをローカル8000番で動かす前提。ポートやドメインを変える場合はここを編集。
  return `${protocol}://${host}:8000/ws/${encodeURIComponent(room)}`;
}
//沢田つけたし
