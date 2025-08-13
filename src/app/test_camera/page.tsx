'use client';

import { useEffect, useRef, useState } from 'react';
import { useCamera } from '@/app/test_camera/camera';

// API base
const API_BASE_RAW = process.env.NEXT_PUBLIC_API_ENDPOINT;
const API_BASE = (API_BASE_RAW ?? '').replace(/\/+$/, '');

async function uploadSnapshot(blob: Blob, contentType: string) {
  const fd = new FormData();
  fd.append('file', blob, contentType === 'image/png' ? 'snapshot.png' : 'snapshot.jpg');
  // trip_id / account_id / device_id / pictured_at は送らない（サーバ側で処理）

  const res = await fetch(`${API_BASE}/api/pictures`, {
    method: 'POST',
    credentials: 'include', // ← Cookie を受け取る/送るのに必須
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upload failed: ${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as { picture_id: number; thumbnail_path: string };
}

export default function Page() {
  // 背面カメラを優先（PC では自動的に唯一のカメラを使用）
  const { videoRef, canvasRef, capture, stream } = useCamera({
    video: { facingMode: { ideal: 'environment' } },
  });

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
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // dataURL → Blob の小ヘルパ（Canvasフォールバック用）
  async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const res = await fetch(dataUrl);
    return res.blob();
  }

  /** スナップ：ImageCapture が使えれば高解像度、なければ Canvas フォールバック */
  const handleSnap = async () => {
    setMessage(null);
    // 旧画像の URL を解放
    if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl);

    let blob: Blob | null = null;

    // --- ImageCapture パス ---
    if (stream && 'ImageCapture' in window) {
      try {
        const track = stream.getVideoTracks()[0];
        const ic = new (window as any).ImageCapture(track);
        blob = await ic.takePhoto(); // 高解像度 JPEG になることが多い
      } catch (e) {
        console.warn('ImageCapture failed, fallback to canvas', e);
      }
    }

    // --- フォールバック：Canvas スクリーンショット ---
    if (!blob) {
      const dataUrl = capture(); // data:image/png;base64,...
      if (!dataUrl) return;
      blob = await dataUrlToBlob(dataUrl);
    }

    const url = URL.createObjectURL(blob);
    setPhotoUrl(url);

    // ここで同時にアップロード
    try {
      setUploading(true);
      const ct = blob.type || 'application/octet-stream';
      const result = await uploadSnapshot(blob, ct);
      setMessage(`保存しました (picture_id=${result.picture_id})`);
    } catch (e: any) {
      console.error(e);
      setMessage(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
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
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
        disabled={uploading}
      >
        {uploading ? '保存中…' : '📸 スナップ & 保存'}
      </button>

      {/* 撮影結果を表示（再撮影時は上書き） */}
      {photoUrl && (
        <img src={photoUrl} alt="snapshot" className="mt-4 border shadow max-w-full" />
      )}
      {message && <p className="text-sm text-gray-600">{message}</p>}

      {/* ストリームのソースとして使うだけなので非表示 */}
      <video ref={videoRef} style={{ display: 'none' }} />
    </main>
  );
}
