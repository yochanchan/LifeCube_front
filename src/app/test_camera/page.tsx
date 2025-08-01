'use client';

import { useEffect, useRef } from 'react';
import { useCamera } from '@/app/test_camera/camera';

export default function Page() {
  // 背面カメラを優先（PC では自動的に唯一のカメラを使用）
  const {
    videoRef,
    canvasRef,
    capture
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

  /** スナップショットを撮影してコンソールに DataURL 長を出力 */
  const handleSnap = () => {
    const dataUrl = capture();
    if (dataUrl) {
      console.log('Captured PNG size:', dataUrl.length);
    }
  };

  return (
    <main className="flex flex-col items-center gap-4 p-4">
      {/* ライブプレビュー用 Canvas */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="border shadow"
      />

      {/* スナップボタン */}
      <button
        onClick={handleSnap}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        📸 スナップ
      </button>

      {/* ストリームのソースとして使うだけなので非表示 */}
      <video ref={videoRef} style={{ display: 'none' }} />
    </main>
  );
}
