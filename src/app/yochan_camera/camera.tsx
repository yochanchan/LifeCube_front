'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

export function useYochanCamera(
  constraints: MediaStreamConstraints = { video: true },
  deviceId?: string
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | undefined>(deviceId);

  // カメラストリームを開始する関数
  const startStream = useCallback(async (newDeviceId?: string) => {
    // 既存のストリームを停止
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null); // ストリームをクリア
    }

    try {
      const videoConstraints = {
        ...constraints.video,
        deviceId: newDeviceId ? { exact: newDeviceId } : undefined
      };

      const newConstraints = {
        ...constraints,
        video: videoConstraints
      };

      const newStream = await navigator.mediaDevices.getUserMedia(newConstraints);
      setStream(newStream);
      setCurrentDeviceId(newDeviceId);
    } catch (e) {
      console.error('getUserMedia failed', e);
    }
  }, [constraints, stream]);

  /** ストリーム取得は一度だけにする。開発用ではuseEffectが2回走ってしまうことへの対処 */
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        if (!canceled) {
          await startStream(deviceId);
        }
      } catch (e) {
        console.error('Initial camera setup failed', e);
      }
    })();
    return () => {
      canceled = true;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
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
      
      // ストリームが準備できてからplay()を呼ぶ
      v.play().catch((error) => {
        console.warn('Video play failed:', error);
      });
    };
    v.addEventListener('loadedmetadata', handleLoaded);

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

  // カメラを切り替える関数
  const switchCamera = useCallback((newDeviceId: string) => {
    startStream(newDeviceId);
  }, [startStream]);

  return { 
    videoRef, 
    canvasRef, 
    capture, 
    stream, 
    currentDeviceId,
    switchCamera 
  };
} 