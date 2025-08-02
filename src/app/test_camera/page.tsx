'use client';

import { useEffect, useRef, useState } from 'react';
import { useCamera } from '@/app/test_camera/camera';

export default function Page() {
  // 背面カメラを優先（PC では自動的に唯一のカメラを使用）
  const {
    videoRef,
    canvasRef,
    capture,
    stream          /* ← 追加: ImageCapture 用に取得 */
  } = useCamera({ video: { facingMode: { ideal: 'environment' } } });

  /** Canvas にライブプレビューを描画するループ */
  const rafId = useRef<number | null>(null);
  useEffect(() => {
    const draw = () => {
      if (videoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
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
  }, []);

  /** 撮影した静止画の URL を保持（再撮影で上書き） */
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  /** スナップ：ImageCapture が使えれば高解像度、なければ Canvas フォールバック */
  const handleSnap = async () => {
    // 旧画像の URL を解放
    if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl);

    // --- ImageCapture パス ---
    if (stream && 'ImageCapture' in window) {
      try {
        const track = stream.getVideoTracks()[0];
        const ic = new (window as any).ImageCapture(track);
        const blob: Blob = await ic.takePhoto();         // 高解像度 JPEG
        const url = URL.createObjectURL(blob);
        setPhotoUrl(url);
        return;
      } catch (e) {
        console.warn('ImageCapture failed, fallback to canvas', e);
        /* 続けてフォールバックを試す */
      }
    }

    // --- フォールバック：Canvas スクリーンショット ---
    const dataUrl = capture();
    if (dataUrl) setPhotoUrl(dataUrl);
  };

  return (
    <main className="flex flex-col items-center gap-4 p-4">
      {/* ライブプレビュー用 Canvas */}
      <canvas
        ref={canvasRef}
        className="border shadow w-full h-auto"
        style={{ maxWidth: '640px' }}
      ></canvas>

      {/* スナップボタン */}
      <button
        onClick={handleSnap}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        📸 スナップ
      </button>

      {/* 撮影結果を表示（再撮影時は上書き） */}
      {photoUrl && (
        <img
          src={photoUrl}
          alt="snapshot"
          className="mt-4 border shadow max-w-full"
        />
      )}

      {/* ストリームのソースとして使うだけなので非表示 */}
      <video ref={videoRef} style={{ display: 'none' }} />
    </main>
  );
}
