// src/app/components/LatestPreview.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiclient } from "@/lib/apiclient";

type Policy = "recorder" | "shooter";

type PhotoItem = {
  seq: number;             // 降順で“最新”選定に使う
  device_id: string;
  image_path: string;      // 相対パス（/api/...）
  pictured_at?: string;
};

type MsgPhotoUploaded = {
  type: "photo_uploaded";
  seq?: number;            // ← 無い場合もあるので後述で補完
  picture_id: number;
  device_id: string;
  image_url?: string;      // 互換：旧フィールド名（絶対URLの可能性）
  image_path?: string;     // 新フィールド名（相対パス推奨）
  pictured_at?: string;
};

type LatestPreviewProps = {
  apiBase: string;                    // 互換のため受け取るが、直挿しはしない
  /** RefObject でも MutableRefObject でもOKな構造的型 */
  wsRef: { current: WebSocket | null };
  policy: Policy;
  myDeviceId: string;
  debounceMs?: number;
  wsReady?: WebSocket["readyState"];
};

/** 旧 image_url（絶対URL）のとき、apiBase と同一オリジンならパスへ正規化 */
function normalizeToPath(urlOrPath: string | undefined, apiBase: string): string | null {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith("/")) return urlOrPath; // 既にパス
  try {
    const abs = new URL(urlOrPath);
    const base = new URL(apiBase || "/", window.location.origin);
    // 同一オリジンのみ採用（そうでないと Authorization が付与できない）
    if (abs.origin === base.origin) {
      return `${abs.pathname}${abs.search}${abs.hash}`;
    }
    return null; // 別オリジンは捨てる
  } catch {
    // 不正URL（例: 相対だが先頭が / じゃない）などは捨てる
    return null;
  }
}

export default function LatestPreview({
  apiBase,
  wsRef,
  policy,
  myDeviceId,
  debounceMs = 1200,
  wsReady,
}: LatestPreviewProps) {
  const latestMapRef = useRef<Map<string, PhotoItem>>(new Map());
  const [preview, setPreview] = useState<PhotoItem | null>(null);

  // Object URL 管理
  const [objUrl, setObjUrl] = useState<string | null>(null);
  const revokeRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Object URL クリーンアップ
  useEffect(() => {
    return () => {
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = null;
      }
    };
  }, []);

  // 最新候補を UI に反映（デバウンス）
  const flushPick = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const values = Array.from(latestMapRef.current.values());
      if (values.length === 0) {
        setPreview(null);
        return;
      }
      if (policy === "recorder") {
        // 自分以外を優先。なければ全体の最大 seq
        const others = values.filter((v) => v.device_id !== myDeviceId);
        const pickFrom = (others.length > 0 ? others : values).sort((a, b) => b.seq - a.seq);
        setPreview(pickFrom[0] ?? null);
      } else {
        // shooter: 自分の最大 seq（要件どおり）
        const mine = values.filter((v) => v.device_id === myDeviceId).sort((a, b) => b.seq - a.seq);
        setPreview(mine[0] ?? null);
      }
    }, debounceMs);
  };

  // WS 受信
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const onMessage = (ev: MessageEvent) => {
      try {
        const raw = JSON.parse(ev.data);
        if (raw?.type !== "photo_uploaded") return;

        const m = raw as MsgPhotoUploaded;
        const seq = Number.isFinite(m.seq)
          ? (m.seq as number)
          : (m.pictured_at ? Date.parse(m.pictured_at) : Date.now()); // ← 補完

        // 新旧フィールドを考慮しつつ、絶対URLは apiBase と同一オリジンのときのみパス化
        const image_path =
          normalizeToPath(m.image_path, apiBase) ??
          normalizeToPath(m.image_url, apiBase);
        if (!image_path) return;

        const item: PhotoItem = {
          seq,
          device_id: m.device_id,
          image_path,
          pictured_at: m.pictured_at,
        };

        const map = latestMapRef.current;
        const prev = map.get(item.device_id);
        if (!prev || item.seq > prev.seq) {
          map.set(item.device_id, item);
        }
        flushPick();
      } catch {
        /* noop */
      }
    };

    ws.addEventListener("message", onMessage);
    return () => ws.removeEventListener("message", onMessage);
  }, [wsRef, policy, myDeviceId, debounceMs, wsReady, apiBase]);

  // ✅ ローカル即時イベントでも反映（WS往復待ちを回避）
  useEffect(() => {
    const onLocal = (ev: Event) => {
      const ce = ev as CustomEvent<MsgPhotoUploaded>;
      const m = ce.detail;
      if (!m) return;

      const seq = Number.isFinite(m.seq as number)
        ? (m.seq as number)
        : (m.pictured_at ? Date.parse(m.pictured_at!) : Date.now());

      const image_path =
        normalizeToPath(m.image_path, apiBase) ??
        normalizeToPath(m.image_url, apiBase);
      if (!image_path) return;

      const item: PhotoItem = {
        seq,
        device_id: m.device_id,
        image_path,
        pictured_at: m.pictured_at,
      };

      const map = latestMapRef.current;
      const prev = map.get(item.device_id);
      if (!prev || item.seq > prev.seq) {
        map.set(item.device_id, item);
      }
      flushPick();
    };

    window.addEventListener("photo_uploaded_local", onLocal as EventListener);
    return () => window.removeEventListener("photo_uploaded_local", onLocal as EventListener);
  }, [policy, myDeviceId, debounceMs, apiBase]);

  // プレビュー対象が変わったら、認証付きで Blob 取得 → Object URL を差し替え
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!preview) {
        if (revokeRef.current) {
          URL.revokeObjectURL(revokeRef.current);
          revokeRef.current = null;
        }
        setObjUrl(null);
        return;
      }
      setLoading(true);
      try {
        // Authorization 付きで取得（apiclient 側が Bearer を付与）
        const url = await apiclient.getObjectUrl(preview.image_path);
        if (cancelled) {
          // 生成しちゃったURLは即破棄
          URL.revokeObjectURL(url);
          return;
        }
        if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = url;
        setObjUrl(url);
      } catch (e) {
        console.warn("[LatestPreview] fetch image failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const caption = useMemo(() => {
    if (!preview) return null;
    const t = preview.pictured_at ? new Date(preview.pictured_at).toLocaleTimeString() : `seq=${preview.seq}`;
    return `${t} / ${preview.device_id}`;
  }, [preview]);

  return (
    <section className="rounded-2xl bg-white p-2 shadow-sm">
      {!objUrl ? (
        <div className="mt-2 min-h-[44px] rounded-lg px-3 py-2 text-left" style={{ backgroundColor: "#EEFAF9", color: "#2B578A" }}>（まだ写真がありません）</div>
      ) : (
        <figure className="mt-2 overflow-hidden rounded-xl bg-white ring-1 ring-rose-100">
          {/* 直接API URLを刺さないこと！Authorizationが付かず403になる */}
          <img
            src={objUrl}
            alt={caption ?? "latest"}
            className="block max-h-96 w-full bg-black/5 object-contain"
            loading="eager"
            decoding="async"
          />
          <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-rose-700">
            <span className="truncate"></span>
            {loading && <span className="rounded bg-rose-50 px-2 py-0.5">読み込み中…</span>}
          </figcaption>
        </figure>
      )}
    </section>
  );
}
