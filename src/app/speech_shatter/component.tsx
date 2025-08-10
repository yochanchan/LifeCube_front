// src/app/speech_shatter/component.tsx (チームルール適合・最終完成版)

"use client";

import React, { useState, useRef, useEffect } from 'react';
import RecordRTC from 'recordrtc';

const SpeechShatterComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [statusMessage, setStatusMessage] = useState('準備中...');

  const recorder = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const isInitialAttempt = useRef(true);

  useEffect(() => {
    setStatusMessage('WebSocketサーバーに接続しています...');

    // ▼▼▼【変更点1】チームの環境変数名に合わせて修正し、WS用も追加 ▼▼▼
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      setStatusMessage("エラー: WebSocketの接続先URLが設定されていません。");
      console.error("環境変数 NEXT_PUBLIC_WS_URL が設定されていません。");
      return;
    }
    
    console.log("接続先のWebSocket URL:", wsUrl);
    
    // ▼▼▼【変更点2】URLの動的生成ロジックを削除し、環境変数を直接使用 ▼▼▼
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onopen = () => {
      console.log("WebSocket接続に成功しました。");
      setStatusMessage('認識待機中（下のボタンで開始）');
      isInitialAttempt.current = false;
    };

    socketRef.current.onerror = (error) => {
      if (!isInitialAttempt.current) {
        console.error("WebSocket接続エラー:", error);
      }
      setStatusMessage('エラー: WebSocketサーバーに接続できません。');
    };

    socketRef.current.onclose = () => {
      console.warn("WebSocket接続が終了しました。");
      if (!isInitialAttempt.current && isRecording) {
          setStatusMessage('エラー: WebSocket接続が切れました。');
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      stopAutoRecording();
    };
  }, []);

  const sendBlobToServer = (blob: Blob) => {
    if (blob.size === 0) return;
    
    const formData = new FormData();
    formData.append('audio_file', blob, 'recording.webm');

    // ▼▼▼【変更点3】HTTP APIのURLもチームの環境変数名に合わせて修正 ▼▼▼
    const apiEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;
    const fetchUrl = `${apiEndpoint}/transcribe_audio`;

    fetch(fetchUrl, {
      method: 'POST',
      body: formData,
    })
    .then(response => response.json())
    .then(data => {
      if (data.success && data.transcription) {
        const newTranscript = data.transcription;
        setFinalTranscript(prev => prev + newTranscript + ' ');

        const triggerWord = "シャッター";
        if (newTranscript.includes(triggerWord)) {
          console.log("「シャッター」を検知！ 写真撮影命令を送信します。");
          setStatusMessage("「シャッター」を検知！ 写真撮影命令を送信しました。");
          
          const socket = socketRef.current;
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "chat",
                message: "take_photo",
              })
            );
            console.log("WebSocketメッセージ 'take_photo' を送信しました。");
          } else {
            console.error("WebSocketが接続されていないため、命令を送信できません。");
            setStatusMessage("エラー: WebSocket接続が確立されていません。");
          }
        }
      }
    })
    .catch(error => {
      console.error('文字起こしAPIへの送信エラー:', error);
    });
  };

  // ... (以降の processAndRestart, startAutoRecording, stopAutoRecording, return文は変更ありません)
  const processAndRestart = () => {
    if (!recorder.current) return;

    recorder.current.stopRecording(() => {
      const blob = recorder.current!.getBlob();
      sendBlobToServer(blob);
      recorder.current!.startRecording();
    });
  };

  const startAutoRecording = async () => {
    setStatusMessage('音声認識中...');
    if (isRecording) return;
    setFinalTranscript('');
    
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      console.log("自動文字起こしを開始しました。");

      recorder.current = new RecordRTC(streamRef.current, {
        type: 'audio',
        mimeType: 'audio/webm;codecs=opus',
      } as any);
      
      recorder.current.startRecording();
      intervalRef.current = setInterval(processAndRestart, 2000);

    } catch (error) {
      console.error('録音開始エラー:', error);
      setStatusMessage('エラー: マイクを開始できませんでした。');
    }
  };

  const stopAutoRecording = () => {
    if (!isRecording || !recorder.current) return;
    
    if(socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      setStatusMessage('認識待機中（下のボタンで開始）');
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    recorder.current.stopRecording(() => {
        const lastBlob = recorder.current!.getBlob();
        if (lastBlob.size > 0) {
          sendBlobToServer(lastBlob);
        }
  
        recorder.current!.destroy();
        recorder.current = null;
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      });
  
      setIsRecording(false);
      console.log("自動文字起こしを停止しました。");
  };


  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <button 
        onClick={isRecording ? stopAutoRecording : startAutoRecording}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', marginBottom: '20px' }}
      >
        {isRecording ? '■ 認識停止' : '● 音声認識を開始する'}
      </button>

      <div style={{ border: '1px solid #ccc', padding: '10px', minHeight: '40px', background: '#f5f5f5', marginBottom: '20px' }}>
        <p><strong>ステータス:</strong></p>
        <p style={{ fontWeight: 'bold' }}>{statusMessage}</p>
      </div>

      <div style={{ border: '1px solid #ccc', padding: '10px', minHeight: '150px' }}>
        <p><strong>文字起こしログ:</strong></p>
        <p>{finalTranscript}</p>
      </div>
    </div>
  );
};

export default SpeechShatterComponent;