'use client';

import { useEffect, useRef, useState } from 'react';
import { useYochanCamera } from '@/app/yochan_camera/camera';

export default function YochanCameraPage() {
  // 1台目のカメラ（撮影用）
  const camera1 = useYochanCamera({ 
    video: { 
      facingMode: { ideal: 'environment' }
    } 
  });

  // 2台目のカメラ（表示用）
  const camera2 = useYochanCamera({ 
    video: { 
      facingMode: { ideal: 'user' }
    } 
  });

  // 撮影した写真のURL
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  
  // 利用可能なカメラデバイスのリスト
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera1, setSelectedCamera1] = useState<string>('');
  const [selectedCamera2, setSelectedCamera2] = useState<string>('');

  // 利用可能なカメラを取得
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        
        if (videoDevices.length >= 2) {
          setSelectedCamera1(videoDevices[0].deviceId);
          setSelectedCamera2(videoDevices[1].deviceId);
        } else if (videoDevices.length === 1) {
          setSelectedCamera1(videoDevices[0].deviceId);
          setSelectedCamera2(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error('カメラデバイスの取得に失敗しました:', error);
      }
    };
    
    getCameras();
  }, []);

  // カメラ1で撮影
  const handleCapture = async () => {
    // 旧画像のURLを解放
    if (capturedPhotoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }

    // ImageCaptureを使用して高解像度で撮影
    if (camera1.stream && 'ImageCapture' in window) {
      try {
        const track = camera1.stream.getVideoTracks()[0];
        const ic = new (window as any).ImageCapture(track);
        const blob: Blob = await ic.takePhoto();
        const url = URL.createObjectURL(blob);
        setCapturedPhotoUrl(url);
        return;
      } catch (e) {
        console.warn('ImageCapture failed, fallback to canvas', e);
      }
    }

    // フォールバック：Canvasスクリーンショット
    const dataUrl = camera1.capture();
    if (dataUrl) setCapturedPhotoUrl(dataUrl);
  };

  // カメラ2に写真を表示するためのCanvas
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  // カメラ1のライブプレビューを描画するループ
  const rafId1 = useRef<number | null>(null);
  useEffect(() => {
    const draw = () => {
      if (camera1.videoRef.current && camera1.canvasRef.current && camera1.stream) {
        const ctx = camera1.canvasRef.current.getContext('2d');
        if (ctx && camera1.videoRef.current.videoWidth > 0) {
          ctx.drawImage(
            camera1.videoRef.current,
            0,
            0,
            camera1.canvasRef.current.width,
            camera1.canvasRef.current.height
          );
        }
      }
      rafId1.current = requestAnimationFrame(draw);
    };

    draw();
    return () => rafId1.current && cancelAnimationFrame(rafId1.current);
  }, [camera1.stream]);



  // 撮影した写真をカメラ2のCanvasに表示
  useEffect(() => {
    if (capturedPhotoUrl && displayCanvasRef.current) {
      const canvas = displayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Canvasサイズを画像に合わせる
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 画像を描画
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      
      img.src = capturedPhotoUrl;
    }
  }, [capturedPhotoUrl]);

  return (
    <main className="flex flex-col items-center gap-6 p-4 min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold text-gray-800">ようちゃんカメラシステム</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-6xl">
        {/* カメラ1（撮影用） */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <h2 className="text-lg font-semibold mb-4 text-center">カメラ1 - 撮影</h2>
          
          {/* カメラ選択 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              カメラ1を選択:
            </label>
            <select
              value={selectedCamera1}
              onChange={(e) => {
                setSelectedCamera1(e.target.value);
                try {
                  camera1.switchCamera(e.target.value);
                } catch (error) {
                  console.error('カメラ1の切り替えに失敗しました:', error);
                }
              }}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              {availableCameras.map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `カメラ ${camera.deviceId.slice(0, 8)}...`}
                </option>
              ))}
            </select>
          </div>

          {/* ライブプレビュー */}
          <canvas
            ref={camera1.canvasRef}
            className="w-full h-auto border border-gray-300 rounded-md mb-4"
            style={{ maxHeight: '300px' }}
          />

          {/* 撮影ボタン */}
          <button
            onClick={handleCapture}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            📸 撮影
          </button>

          {/* 撮影結果 */}
          {capturedPhotoUrl && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">撮影結果:</h3>
              <img
                src={capturedPhotoUrl}
                alt="撮影した写真"
                className="w-full h-auto border border-gray-300 rounded-md"
                style={{ maxHeight: '200px' }}
              />
            </div>
          )}
        </div>

        {/* カメラ2（表示用） */}
        <div className="bg-white rounded-lg shadow-lg p-4">
          <h2 className="text-lg font-semibold mb-4 text-center">カメラ2 - 表示</h2>



          {/* 撮影した写真の表示エリア */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">撮影した写真の表示:</h3>
            <canvas
              ref={displayCanvasRef}
              className="w-full h-auto border-2 border-dashed border-gray-400 rounded-md bg-gray-50"
              style={{ minHeight: '300px' }}
            />
            {!capturedPhotoUrl && (
              <div className="text-center text-gray-500 py-8">
                カメラ1で撮影すると、ここに写真が表示されます
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 非表示のvideo要素 */}
      <video ref={camera1.videoRef} style={{ display: 'none' }} />
      <video ref={camera2.videoRef} style={{ display: 'none' }} />
    </main>
  );
} 