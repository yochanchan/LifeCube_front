// src/app/components/SpeechController.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { apiclient } from "@/lib/apiclient";

type TriggerSource = "interim" | "final";

type Props = {
  apiBase: string; // 互換のため残置（未使用）
  defaultRegion: string;
  active: boolean;
  onTrigger?: (p: { keyword: string; source: TriggerSource; text: string; ts: number }) => void;
  onTranscript?: (p: { text: string; isFinal: boolean; ts: number }) => void;
  onStatusChange?: (s: "idle" | "starting" | "running" | "stopped" | "error", detail?: string) => void;
  cooldownMs?: number;
};

// expires_at は「秒」
type TokenResp = { token: string; region: string; expires_at: number };

/* 文字正規化 & キーワード（省略なし: 元のまま） */
function normalizeJa(s: string): string {
  try {
    const nfkc = s.normalize("NFKC").toLowerCase();
    const hira = nfkc.replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
    return hira.replace(/[！!？?\s、。,.]/g, "");
  } catch {
    return s;
  }
}
function matchKeyword(text: string): string | null {
  const t = normalizeJa(text);
  const rules: { keyword: string; re: RegExp }[] = [
    { keyword: "とる/撮る", re: /(とっ|とれ|とる|とって|取って|撮って|取る|撮る)/ },
    { keyword: "シャッター", re: /(しゃった)/ },
    { keyword: "写真/撮影", re: /(しゃしん|さつえい)/ },
    { keyword: "はい、チーズ", re: /(はいちーず|ちーず)/ },
    { keyword: "すごい/最高", re: /(すごい|すげー|やばい|最高|すばらしい|素晴らしい|ぜっけい|絶景|景色)/ },
    { keyword: "きれい/美しい", re: /(きれい|うつくしい|美しい)/ },
    { keyword: "見て/発見", re: /(みて|見て|あれ|なにあれ|おもしろい|めずらしい|面白い|珍しい)/ },
    { keyword: "かわいい", re: /(かわいい|可愛い|かわいー|ねがお|寝顔)/ },
    { keyword: "驚き/感嘆", re: /(うわ|うわー|まじで)/ },
    { keyword: "楽しい/面白い", re: /(たのしい|楽しい|うける|受ける|わらった|笑った|笑顔|えがお)/ },
    { keyword: "大きい", re: /(おおきい|大きい|でかい|でっかい)/ },
  ];
  for (const r of rules) if (r.re.test(t)) return r.keyword;
  return null;
}

/* トークン更新タイミング（秒→ms計算） */
function computeRefreshDelayMs(expiresAtSec: number): number {
  const nowMs = Date.now();
  const expMs = expiresAtSec * 1000;
  const lifetime = expMs - nowMs;
  if (lifetime <= 0) return 10_000;

  const leadNormal = 60_000;
  const leadShort = 5_000;

  let delay: number;
  if (lifetime > leadNormal + 5_000) {
    delay = lifetime - leadNormal;
  } else if (lifetime > leadShort + 5_000) {
    delay = lifetime - leadShort;
  } else {
    delay = Math.max(10_000, Math.floor(lifetime * 0.8));
  }
  return Math.max(5_000, delay);
}

export default function SpeechController({
  apiBase,
  defaultRegion,
  active,
  onTrigger,
  onTranscript,
  onStatusChange,
  cooldownMs = 5000,
}: Props) {
  const recRef = useRef<SpeechSDK.SpeechRecognizer | null>(null);
  const tokenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [region, setRegion] = useState(defaultRegion);
  const lastFireAtRef = useRef<number>(0);

  async function fetchToken(): Promise<TokenResp> {
    // ✅ Authorization 自動付与（POST）
    const res = await apiclient.fetch("/azurespeech/token", { method: "POST" });
    if (!res.ok) throw new Error(`token failed: ${res.status}`);
    return res.json();
  }

  function clearTokenTimer() {
    if (tokenTimerRef.current) {
      clearTimeout(tokenTimerRef.current);
      tokenTimerRef.current = null;
    }
  }

  function tryFire(keyword: string, source: TriggerSource, text: string) {
    const now = Date.now();
    if (now - lastFireAtRef.current < cooldownMs) return;
    lastFireAtRef.current = now;
    onTrigger?.({ keyword, source, text, ts: now });
  }

  async function start() {
    if (recRef.current) return; // 既に稼働中
    onStatusChange?.("starting");

    const tk = await fetchToken();
    setRegion(tk.region);

    const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(tk.token, tk.region);
    speechConfig.speechRecognitionLanguage = "ja-JP";
    const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
    recRef.current = recognizer;

    recognizer.sessionStarted = () => console.log("[Speech] sessionStarted");
    recognizer.speechStartDetected = () => console.log("[Speech] speechStartDetected");
    recognizer.speechEndDetected = () => console.log("[Speech] speechEndDetected");

    recognizer.recognizing = (_s, e) => {
      const txt = e.result?.text ?? "";
      if (txt) {
        onTranscript?.({ text: txt, isFinal: false, ts: Date.now() });
        const kw = matchKeyword(txt);
        if (kw) tryFire(kw, "interim", txt);
      }
    };

    recognizer.recognized = (_s, e) => {
      const txt = e.result?.text ?? "";
      if (txt) {
        onTranscript?.({ text: txt, isFinal: true, ts: Date.now() });
        const kw = matchKeyword(txt);
        if (kw) tryFire(kw, "final", txt);
      }
    };

    recognizer.canceled = (_s, e) => {
      console.warn("[Speech] canceled:", e?.errorDetails, e?.reason);
      onStatusChange?.("error", `canceled: ${e?.errorDetails ?? ""}`);
    };
    recognizer.sessionStopped = () => onStatusChange?.("stopped");

    await new Promise<void>((resolve, reject) => {
      console.log("[Speech] starting recognition…");
      recognizer.startContinuousRecognitionAsync(resolve, reject);
    });

    onStatusChange?.("running");

    const delay = computeRefreshDelayMs(tk.expires_at);
    console.log(
      `[Speech] token expires_in~= ${Math.max(0, Math.round(tk.expires_at - Date.now() / 1000))}s, refresh in ${Math.round(
        delay / 1000
      )}s`
    );

    clearTokenTimer();
    tokenTimerRef.current = setTimeout(async () => {
      if (!recRef.current) return;
      try {
        await fetchToken(); // 取得できるかの確認だけ（再起動方式}
        await stop(false);
        await start();
      } catch (e) {
        console.error("[Speech] token refresh failed", e);
        onStatusChange?.("error", "token refresh failed");
      }
    }, delay);
  }

  async function stop(reportStopped = true) {
    clearTokenTimer();
    const rec = recRef.current;
    if (!rec) {
      if (reportStopped) onStatusChange?.("stopped");
      return;
    }
    await new Promise<void>((resolve) => {
      try {
        rec.stopContinuousRecognitionAsync(
          () => {
            try {
              rec.close();
            } catch { }
            resolve();
          },
          () => {
            try {
              rec.close();
            } catch { }
            resolve();
          }
        );
      } catch {
        try {
          rec.close();
        } catch { }
        resolve();
      }
    });
    recRef.current = null;
    if (reportStopped) onStatusChange?.("stopped");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (active) await start();
        else await stop();
      } catch (e: any) {
        if (!cancelled) onStatusChange?.("error", e?.message ?? String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    return () => {
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
