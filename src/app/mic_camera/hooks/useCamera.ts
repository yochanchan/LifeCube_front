// frontend/src/app/mic_camera/hooks/useCamera.ts
"use client";

import { useEffect, useRef, useState } from "react";

export function useCamera(constraints: MediaStreamConstraints = { video: true }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // ① getUserMedia でストリーム取得
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        if (canceled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
      } catch (e) {
        console.error("getUserMedia failed", e);
      }
    })();
    return () => {
      canceled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ② video が準備できたら srcObject 設定 & canvas サイズ反映
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
    v.addEventListener("loadedmetadata", handleLoaded);
    v.play().catch(console.error);

    return () => v.removeEventListener("loadedmetadata", handleLoaded);
  }, [stream]);

  // ③ スナップショット
  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return null;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  };

  return { videoRef, canvasRef, capture, stream };
}
