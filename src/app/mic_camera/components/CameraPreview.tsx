"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  apiBase: string;
  wsRef: React.MutableRefObject<WebSocket | null>;
  myDeviceId: string;
};

export default function CameraPreview({ apiBase, wsRef, myDeviceId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // getUserMedia → video
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
      } catch (e) {
        console.error("getUserMedia failed", e);
        setMsg("カメラを開始できませんでした（権限/デバイスの確認）");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // video に stream を貼る
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) return;

    v.srcObject = stream;
    const onLoaded = () => {
      const c = canvasRef.current;
      if (c) {
        c.width = v.videoWidth || 640;
        c.height = v.videoHeight || 480;
      }
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.play().catch(() => { });
    return () => v.removeEventListener("loadedmetadata", onLoaded);
  }, [stream]);

  // ローカルイベント（同一タブ）
  useEffect(() => {
    const handler = () => {
      void snapAndUpload();
    };
    window.addEventListener("mic-camera:take_photo", handler);
    return () => window.removeEventListener("mic-camera:take_photo", handler);
  }, []);

  // WS受信（同room・他端末） → 自分発（origin_device_id一致）は無視
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const onMsg = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === "take_photo") {
          if (data.origin_device_id && data.origin_device_id === myDeviceId) {
            // 自分発は無視
            return;
          }
          void snapAndUpload();
        }
      } catch {
        // noop
      }
    };

    ws.addEventListener("message", onMsg);
    return () => ws.removeEventListener("message", onMsg);
  }, [wsRef, myDeviceId]);

  // 撮影 → アップロード
  const snapAndUpload = async () => {
    setMsg(null);
    let blob: Blob | null = null;

    // 1) ImageCapture 高解像度（あれば）
    try {
      const track = stream?.getVideoTracks()[0];
      if (track && "ImageCapture" in window) {
        // @ts-ignore
        const ic = new window.ImageCapture(track);
        blob = await ic.takePhoto();
      }
    } catch (e) {
      console.warn("ImageCapture failed", e);
    }

    // 2) Canvas フォールバック
    if (!blob) {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c) return;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", 0.92);
      const r = await fetch(dataUrl);
      blob = await r.blob();
    }

    // 3) Upload（pictures.pyは account_id/ pictured_at をサーバ側で補完）
    try {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", blob, blob.type === "image/png" ? "snapshot.png" : "snapshot.jpg");
      const res = await fetch(`${apiBase}/api/pictures`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`upload failed: ${res.status} ${res.statusText} ${text}`);
      }
      const j = await res.json();
      setMsg(`保存しました（picture_id=${j.picture_id}）`);
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-rose-100 shadow">
        <video ref={videoRef} className="w-full rounded-xl bg-black/5" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void snapAndUpload()}
          disabled={uploading}
          className="rounded-xl bg-rose-600 px-4 py-2 text-white shadow hover:bg-rose-700 disabled:opacity-50"
        >
          {uploading ? "保存中…" : "📸 いま撮る"}
        </button>
      </div>

      {msg && <div className="text-sm text-rose-700">{msg}</div>}
    </section>
  );
}
