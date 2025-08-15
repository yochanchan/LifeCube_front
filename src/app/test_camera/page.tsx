'use client';
//import { useEffect, useRef, useState } from 'react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useCamera } from '@/app/test_camera/camera';
//沢田つけたし
import Link from 'next/link';
import { useWebSocket } from '@/app/lib/websocket';
//沢田つけたし
// API base
const API_BASE_RAW = process.env.NEXT_PUBLIC_API_ENDPOINT;
const API_BASE = (API_BASE_RAW ?? '').replace(/\/+$/, '');

async function uploadSnapshot(blob: Blob, contentType: string) {
  // 固定値（PoC要件）
  const accountId = '1';
  const deviceId = 'yochan';
  const picturedAt = new Date().toISOString(); // 送らなくてもOK（サーバがJST現在時刻を使用）

  const fd = new FormData();
  fd.append('file', blob, contentType === 'image/png' ? 'snapshot.png' : 'snapshot.jpg');
  fd.append('account_id', accountId);
  fd.append('device_id', deviceId);
  // trip_id は null 想定 → 送らない
  fd.append('pictured_at', picturedAt);

  const res = await fetch(`${API_BASE}/api/pictures`, {
    method: 'POST',
    //沢田つけたし
    credentials: 'include', // Cookie（セッション情報）を送信
    //沢田つけたし
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    //沢田つけたし
    if (res.status === 401) {
      throw new Error('ログインが必要です。先にログインしてください。');
    }
    //沢田つけたし
    throw new Error(`upload failed: ${res.status} ${res.statusText} ${text}`);
  }
  return (await res.json()) as { picture_id: number; thumbnail_path: string };
}

export default function Page() {
  // 背面カメラを優先（PC では自動的に唯一のカメラを使用）
  const { videoRef, canvasRef, capture, stream } = useCamera({
    video: { facingMode: { ideal: 'environment' } },
  });

//沢田つけたし
  // WebSocket: test_display と同じルームで共有
  const roomId = 'test_room2';
  const userId = useMemo(() => `camera_${Math.random().toString(36).slice(2, 10)}`, []);
  const { isConnected, sendPhoto, sendNotification } = useWebSocket(roomId, userId);
//沢田つけたし

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

  //沢田つけたし
  // Blob → dataURL
  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  //沢田つけたし

  /** スナップ：ImageCapture が使えれば高解像度、なければ Canvas フォールバック */
  const handleSnap = async () => {
    setMessage(null);
    // 旧画像の URL を解放
    if (photoUrl?.startsWith('blob:')) URL.revokeObjectURL(photoUrl);

    let blob: Blob | null = null;
    //沢田つけたし
    let canvasDataUrl: string | null = null;
    //沢田つけたし

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
    //const dataUrl = capture(); // data:image/png;base64,...
    //if (!dataUrl) return;
    //blob = await dataUrlToBlob(dataUrl);

      // //沢田つけたし
      canvasDataUrl = capture(); // data:image/png;base64,...
      if (!canvasDataUrl) return;
      blob = await dataUrlToBlob(canvasDataUrl);
      //沢田つけたし
    }

    const url = URL.createObjectURL(blob);
    setPhotoUrl(url);
   
    // ここで同時にアップロード
    //沢田つけたし
    // WebSocket 送信（dataURL形式）
    try {
      const dataUrlForWs = canvasDataUrl ?? (await blobToDataUrl(blob));
      //沢田つけたし
      console.log('WebSocket送信準備完了:', {
        isConnected,
        dataUrlLength: dataUrlForWs.length,
        roomId,
        userId
      });
      
      if (isConnected) {
        sendPhoto(dataUrlForWs);
        sendNotification('test_camera: 新しい写真が撮影されました');
        //沢田つけたし
        console.log('✅ WebSocket送信完了: 写真と通知');
        setMessage('撮影完了 & WebSocket送信完了');
      } else {
        console.warn('⚠️ WebSocket未接続のため送信できません');
        setMessage('撮影完了（WebSocket未接続のため送信できません）');
        //沢田つけたし
      }
    } catch (e) {
      //沢田つけたし
      //console.error('failed to send over WebSocket', e);
      console.error('❌ WebSocket送信エラー:', e);
      setMessage(`撮影完了（WebSocket送信エラー: ${e})`);
      //沢田つけたし
    }

    // バックエンド保存（既存の機能は維持）
    //沢田つけたし
    try {
      setUploading(true);
      const ct = blob.type || 'application/octet-stream';
      const result = await uploadSnapshot(blob, ct);
    //setMessage(`保存しました (picture_id=${result.picture_id})`);
      //沢田つけたし
      console.log('✅ バックエンド保存完了:', result);
      setMessage(prev => prev ? `${prev} & バックエンド保存完了 (ID: ${result.picture_id})` : `バックエンド保存完了 (ID: ${result.picture_id})`);
      //沢田つけたし
    } catch (e: any) {
      //沢田つけたし
      //console.error(e);
      //setMessage(e?.message ?? String(e));
      //沢田つけたし
      console.error('❌ バックエンド保存エラー:', e);
      setMessage(prev => prev ? `${prev} & バックエンド保存エラー: ${e?.message ?? String(e)}` : `バックエンド保存エラー: ${e?.message ?? String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="flex flex-col items-center gap-4 p-4">
      {/*沢田つけたし*/}
      {/* WebSocket接続状態とtest_displayへのリンク */}
      <div className="flex items-center gap-3">
        <span className={`inline-block w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-gray-600">{isConnected ? 'WebSocket接続中' : 'WebSocket未接続'}</span>
        <Link href="/test_display" className="ml-4 rounded bg-gray-700 px-3 py-1 text-white hover:bg-gray-800">
          test_display へ
        </Link>
      </div>
      {/*沢田つけたし*/}
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
      
     {/*{uploading ? '保存中…' : '📸 スナップ & 保存'}*/}
        {/*沢田つけたし*/}  
        {uploading ? '保存中…' : '📸 スナップ & 送信'}
        {/*沢田つけたし*/}
      </button>

      {/* 撮影結果を表示（再撮影時は上書き） */}
      {photoUrl && (
        <img src={photoUrl} alt="snapshot" className="mt-4 border shadow max-w-full" />
      )}
      {message && <p className="text-sm text-gray-600">{message}</p>}
     {/*沢田つけたし*/}
      {/* ログインが必要な場合のガイダンス */}
      {message && message.includes('ログインが必要') && (
        <div className="mt-2 text-center">
          <Link href="/login" className="text-blue-600 hover:text-blue-800 underline">
            ログインページへ
          </Link>
        </div>
      )}
    {/*沢田つけたし*/}

      {/* ストリームのソースとして使うだけなので非表示 */}
      <video ref={videoRef} style={{ display: 'none' }} />
    </main>
  );
}
