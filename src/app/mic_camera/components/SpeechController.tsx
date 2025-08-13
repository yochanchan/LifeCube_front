// src/app/mic_camera/components/SpeechController.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

export default function SpeechController({
  apiBase,
  onShutterDetected,
}: {
  apiBase: string;
  onShutterDetected: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [statusMessage, setStatusMessage] = useState("認識待機中（開始で録音）");

  // RecordRTC を遅延ロード
  const RecordRTCRef = useRef<any>(null);
  const recorder = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  async function ensureRecordRTC() {
    if (RecordRTCRef.current) return RecordRTCRef.current;
    const mod = await import("recordrtc"); // ← ブラウザでのみ読み込む
    RecordRTCRef.current = (mod as any).default ?? mod;
    return RecordRTCRef.current;
  }

  async function sendBlobToServer(blob: Blob) {
    if (!blob.size) return;
    const formData = new FormData();
    formData.append("audio_file", blob, "rec.webm");
    const res = await fetch(`${apiBase}/speech/transcribe_audio`, { method: "POST", body: formData });
    const data = await res.json().catch(() => ({} as any));
    const text: string = data?.transcription ?? "";
    if (!text) return;

    setFinalTranscript((prev) => prev + text + " ");

    if (text.includes("シャッター")) {
      setStatusMessage("合言葉を検知 → 撮影命令を送信");
      onShutterDetected();
    }
  }

  function processAndRestart() {
    if (!recorder.current) return;
    recorder.current.stopRecording(async () => {
      const blob = recorder.current!.getBlob();
      await sendBlobToServer(blob);
      recorder.current!.startRecording();
    });
  }

  async function startAutoRecording() {
    setStatusMessage("音声認識中…");
    if (isRecording) return;
    setFinalTranscript("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const RecordRTC = await ensureRecordRTC();
      recorder.current = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/webm;codecs=opus",
      } as any);
      recorder.current.startRecording();

      intervalRef.current = setInterval(processAndRestart, 2000);
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setStatusMessage("エラー: マイクを開始できませんでした。");
    }
  }

  function stopAutoRecording() {
    if (!isRecording || !recorder.current) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;

    recorder.current.stopRecording(async () => {
      const last = recorder.current!.getBlob();
      if (last.size > 0) await sendBlobToServer(last);
      recorder.current!.destroy();
      recorder.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    });

    setIsRecording(false);
    setStatusMessage("認識待機中（開始で録音）");
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      recorder.current?.destroy?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div>
      <button
        onClick={isRecording ? stopAutoRecording : startAutoRecording}
        className="rounded bg-rose-500 px-4 py-2 text-white hover:bg-rose-600"
      >
        {isRecording ? "■ 認識停止" : "● 音声認識を開始する"}
      </button>

      <div className="mt-3 rounded-xl bg-rose-50 p-3 text-rose-800">
        <div className="font-semibold">ステータス</div>
        <div>{statusMessage}</div>
      </div>

      <div className="mt-3 rounded-xl border border-rose-100 p-3 text-rose-700">
        <div className="font-semibold">文字起こしログ</div>
        <div className="whitespace-pre-wrap break-words">{finalTranscript}</div>
      </div>
    </div>
  );
}
