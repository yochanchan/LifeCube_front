// frontend/src/app/mic_camera/components/CameraPreview.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useCamera } from "../hooks/useCamera";

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");

export default function CameraPreview({
  ws,
  myDeviceId,
}: {
  ws: WebSocket | null;
  myDeviceId: string;
}) {
  const { videoRef, canvasRef, capture, stream } = useCamera({
    video: { facingMode: { ideal: "environment" } },
  });

  // ライブプレビュー描画
  const rafId = useRef<number | null>(null);
  useEffect(() => {
    const draw = () => {
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.drawImage(
            videoRef.current,
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        }
      }
      rafId.current = requestAnimationFrame(draw);
    };
    draw();
    return () => rafId.current && cancelAnimationFrame(rafId.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function uploadSnapshot(blob: Blob, contentType: string) {
    const fd = new FormData();
    fd.append("file", blob, contentType === "image/png" ? "snapshot.png" : "snapshot.jpg");
    // trip_id が必要になったら fd.append("trip_id", ...) を追加

    const res = await fetch(`${API_BASE}/api/pictures`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`upload failed: ${res.status} ${res.statusText} ${text}`);
    }
    return (await res.json()) as { picture_id: number; thumbnail_path: string };
  }

  const snapAndUpload = async () => {
    setMessage(null);
    if (photoUrl?.startsWith("blob:")) URL.revokeObjectURL(photoUrl);

    let blob: Blob | null = null;

    // ImageCapture 優先
    if (stream && "ImageCapture" in window) {
      try {
        const track = stream.getVideoTracks()[0];
        const ic = new (window as any).ImageCapture(track);
        blob = await ic.takePhoto();
      } catch (e) {
        console.warn("ImageCapture failed, fallback to canvas", e);
      }
    }
    // Canvas フォールバック
    if (!blob) {
      const dataUrl = capture();
      if (!dataUrl) return;
      blob = await dataUrlToBlob(dataUrl);
    }

    const url = URL.createObjectURL(blob);
    setPhotoUrl(url);

    try {
      setUploading(true);
      const ct = blob.type || "application/octet-stream";
      const result = await uploadSnapshot(blob, ct);
      setMessage(`保存しました (picture_id=${result.picture_id})`);
    } catch (e: any) {
      console.error(e);
      setMessage(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  // ① ローカルイベントで撮影
  useEffect(() => {
    const onLocal = () => void snapAndUpload();
    window.addEventListener("mic-camera:take_photo", onLocal);
    return () => window.removeEventListener("mic-camera:take_photo", onLocal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ② WS受信で撮影（同roomの他端末からの命令）
  useEffect(() => {
    if (!ws) return;

    const onMsg = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "take_photo") {
          // 念のため自分発は無視（サーバは返してこない設計だが二重防止）
          if (msg.origin_device_id && msg.origin_device_id === myDeviceId) return;
          if (msg.target_device_id && msg.target_device_id !== myDeviceId) return;
          void snapAndUpload();
        }
      } catch {
        // noop
      }
    };

    ws.addEventListener("message", onMsg);
    return () => ws.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, myDeviceId]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className="border shadow w-full h-auto rounded-xl"
        style={{ maxWidth: 640 }}
      />
      <button
        onClick={() => void snapAndUpload()}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        disabled={uploading}
      >
        {uploading ? "保存中…" : "📸 スナップ & 保存"}
      </button>
      {photoUrl && (
        <img src={photoUrl} alt="snapshot" className="mt-2 border shadow max-w-full rounded-xl" />
      )}
      {message && <p className="text-sm text-gray-600">{message}</p>}

      {/* ストリームのソース */}
      <video ref={videoRef} style={{ display: "none" }} />
    </div>
  );
}
