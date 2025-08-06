// src/app/test_speech/SpeechComponent.tsx (最終完成・決定版)

"use client";

import React, { useState, useRef, useEffect } from 'react';
import RecordRTC from 'recordrtc';

const SpeechComponent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  
  const recorder = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // サーバーに音声データを送信する関数
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
        setFinalTranscript(prev => prev + data.transcription + ' ');
      }
    })
    .catch(error => {
      console.error('送信エラー:', error);
    });
  };

  // 2秒ごとに録音を区切って、送信と再開を行う関数
  const processAndRestart = () => {
    if (!recorder.current) return;

    // 現在の録音を停止し、コールバックで音声ファイル(blob)を処理する
    recorder.current.stopRecording(() => {
      const blob = recorder.current!.getBlob();
      sendBlobToServer(blob); // 生成された「完全なファイル」をサーバーに送信

      // ▼▼▼▼▼【ここが最重要】▼▼▼▼▼
      // 即座に、次の録音を開始する
      // インスタンスは破棄せず、リセットして再利用する
      recorder.current!.startRecording();
    });
  };

  // 自動文字起こしを開始する関数
  const startAutoRecording = async () => {
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

      // 2秒(2000ミリ秒)ごとに、送信と再開の処理を呼び出すループを開始
      intervalRef.current = setInterval(processAndRestart, 2000);

    } catch (error) {
      console.error('録音開始エラー:', error);
    }
  };

  // 自動文字起こしを停止する関数
  const stopAutoRecording = () => {
    if (!isRecording || !recorder.current) return;

    // ループを停止
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 最後の録音を処理
    recorder.current.stopRecording(() => {
      const lastBlob = recorder.current!.getBlob();
      sendBlobToServer(lastBlob);

      // すべてのリソースを解放
      recorder.current!.destroy();
      recorder.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    });

    setIsRecording(false);
    console.log("自動文字起こしを停止しました。");
  };

  useEffect(() => {
    return () => { stopAutoRecording(); };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>音声認識 (最終完成版)</h2>
      <button 
        onClick={isRecording ? stopAutoRecording : startAutoRecording}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        {isRecording ? '■ 停止' : '● 自動文字起こし開始'}
      </button>

      <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px', minHeight: '200px' }}>
        <p><strong>認識結果:</strong></p>
        <p>{finalTranscript}</p>
      </div>
    </div>
  );
};

export default SpeechComponent;