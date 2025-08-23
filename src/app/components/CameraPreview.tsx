// src/app/components/CameraPreview.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { safeSend } from "../../lib/ws";
import { apiclient } from "@/lib/apiclient";

type Props = {
  apiBase: string; // 互換のため残置（未使用）
  wsRef: React.MutableRefObject<WebSocket | null>;
  myDeviceId: string;
  /** あればこちらを優先して送信。無ければ safeSend(wsRef.current, ...) にフォールバック */
  sendJson?: (msg: unknown) => boolean | void;
  /** 文字起こし部分の表示 */
  children?: React.ReactNode;
};

type UploadResp = {
  picture_id: number;
  thumbnail_path: string;
  image_path?: string | null;
  pictured_at?: string | null;
  device_id?: string | null;
};

export default function CameraPreview({ apiBase, wsRef, myDeviceId, sendJson, children }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // カメラ起動
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => { });
        }
      } catch (e: any) {
        setMsg(`カメラの起動に失敗しました: ${e?.message ?? String(e)}`);
      }
    })();

    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const sendWs = useCallback(
    (payload: unknown) => {
      if (typeof sendJson === "function") {
        try {
          const r = sendJson(payload);
          return typeof r === "boolean" ? r : true;
        } catch {
          /* fallback */
        }
      }
      return safeSend(wsRef.current, payload);
    },
    [sendJson, wsRef]
  );

  // 撮影 & アップロード
  const snapAndUpload = useCallback(async () => {
    if (busy) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    try {
      setBusy(true);
      setMsg(null);

      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas context 取得に失敗しました");

      ctx.drawImage(video, 0, 0, w, h);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob 失敗"))), "image/jpeg", 0.92);
      });

      const fd = new FormData();
      fd.append("file", blob, `snap_${Date.now()}.jpg`);
      fd.append("device_id", myDeviceId);

      // ✅ Authorization 自動付与（Bearer）
      const j = await apiclient.postForm<UploadResp>("/api/pictures", fd);

      // image_path が無い場合もフォールバックで組み立て
      const imagePath = j.image_path ?? `/api/pictures/${j.picture_id}/image`;
      const payload = {
        type: "photo_uploaded",
        picture_id: j.picture_id,
        device_id: myDeviceId,
        image_url: imagePath, // LatestPreview は image_url を読む
        pictured_at: j.pictured_at ?? new Date().toISOString(),
        seq: Date.now(),      // ✅ 最新選定用に必須
      };

      // ✅ 即時ローカル通知（WS往復を待たずプレビュー反映）
      window.dispatchEvent(new CustomEvent("photo_uploaded_local", { detail: payload }));

      // ✅ 共有のためWSにも送る（サーバ側からも同種が流れてくるなら二重でもOK）
      sendWs(payload);

      setMsg("アップロードしました");
      setTimeout(() => setMsg(null), 2000);
    } catch (e: any) {
      setMsg(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, myDeviceId, sendWs]);

  // ローカルイベント → 撮影
  useEffect(() => {
    const onLocal = () => {
      void snapAndUpload();
    };
    window.addEventListener("app:take_photo", onLocal);
    return () => {
      window.removeEventListener("app:take_photo", onLocal);
    };
  }, [snapAndUpload]);

  // WS受信 → 撮影（自端末は無視）
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "take_photo" && msg.origin_device_id !== myDeviceId) {
          void snapAndUpload();
        }
      } catch {
        /* noop */
      }
    };

    ws.addEventListener("message", onMessage);
    return () => ws.removeEventListener("message", onMessage);
  }, [wsRef, myDeviceId, snapAndUpload]);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl bg-black shadow ring-1 ring-rose-200">
        <video ref={videoRef} playsInline muted autoPlay className="aspect-video w-full object-cover" />
      </div>

      {/* 文字起こし部分 */}
      {children}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void snapAndUpload()}
          disabled={busy}
          className={
            "rounded-full px-4 py-2 text-white transition " +
            (busy ? "bg-rose-300" : "bg-rose-500 hover:bg-rose-600")
          }
        >
          {busy ? "アップロード中…" : "手動で撮影"}
        </button>
        {msg && <span className="text-sm text-rose-700">{msg}</span>}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
