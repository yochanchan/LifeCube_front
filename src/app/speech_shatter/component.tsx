// src/app/speech_shatter/component.tsx (最終改善版)

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
  // ▼▼▼【変更点1】初回接続試行のフラグをuseRefで管理 ▼▼▼
  const isInitialAttempt = useRef(true);

  useEffect(() => {
    setStatusMessage('WebSocketサーバーに接続しています...');

    socketRef.current = new WebSocket("ws://localhost:8000/ws_test/ws/yuka");

    socketRef.current.onopen = () => {
      console.log("WebSocket接続に成功しました。");
      setStatusMessage('認識待機中（下のボタンで開始）');
      // ▼▼▼【変更点2】接続が成功したら、初回試行フラグをfalseにする ▼▼▼
      isInitialAttempt.current = false;
    };

    socketRef.current.onerror = (error) => {
      // ▼▼▼【変更点3】初回接続試行中(isInitialAttempt.currentがtrue)はコンソールにエラーを出力しない ▼▼▼
      if (!isInitialAttempt.current) {
        // 2回目以降の「本物の」エラーだけをコンソールに出力する
        console.error("WebSocket接続エラー:", error);
      }
      setStatusMessage('エラー: WebSocketサーバーに接続できません。');
    };

    socketRef.current.onclose = () => {
      console.warn("WebSocket接続が終了しました。");
      // ▼▼▼【変更点4】本物のエラーの場合のみUIに反映させるように条件を少し変更 ▼▼▼
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

  // ... (以降の sendBlobToServer, startAutoRecordingなどの関数は変更なし)
  const sendBlobToServer = (blob: Blob) => {
    if (blob.size === 0) return;
    
    const formData = new FormData();
    formData.append('audio_file', blob, 'recording.webm');

    fetch('http://localhost:8000/transcribe_audio', {
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
    
    // 接続が確立している場合のみ待機メッセージに戻す
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