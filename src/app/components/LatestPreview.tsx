// src/app/components/LatestPreview.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Policy = "recorder" | "shooter";

type PhotoItem = {
  seq: number;
  device_id: string;
  image_url: string;
  pictured_at?: string;
};

type MsgPhotoUploaded = {
  type: "photo_uploaded";
  seq: number;
  picture_id: number;
  device_id: string;
  image_url: string;
  pictured_at?: string;
};

function toAbsUrl(apiBase: string, url: string): string {
  if (!url) return url;
  return url.startsWith("/") ? `${apiBase}${url}` : url;
}

type LatestPreviewProps = {
  apiBase: string;
  /** RefObject でも MutableRefObject でもOKな構造的型 */
  wsRef: { current: WebSocket | null };
  policy: Policy;
  myDeviceId: string;
  debounceMs?: number;
};

export default function LatestPreview({
  apiBase,
  wsRef,
  policy,
  myDeviceId,
  debounceMs = 1200,
}: LatestPreviewProps) {
  const latestMapRef = useRef<Map<string, PhotoItem>>(new Map());
  const [preview, setPreview] = useState<PhotoItem | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type !== "photo_uploaded") return;

        const m = msg as MsgPhotoUploaded;
        const item: PhotoItem = {
          seq: m.seq,
          device_id: m.device_id,
          image_url: m.image_url,
          pictured_at: m.pictured_at,
        };
        const map = latestMapRef.current;
        const prev = map.get(item.device_id);
        if (!prev || item.seq > prev.seq) {
          map.set(item.device_id, item);
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const values = Array.from(map.values());
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
            // shooter: 自分の最大 seq
            const mine = values.filter((v) => v.device_id === myDeviceId).sort((a, b) => b.seq - a.seq);
            setPreview(mine[0] ?? null);
          }
        }, debounceMs);
      } catch {
        /* noop */
      }
    };

    ws.addEventListener("message", onMessage);
    return () => {
      ws.removeEventListener("message", onMessage);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [wsRef, policy, myDeviceId, debounceMs]);

  const imageSrc = useMemo(
    () => (preview ? toAbsUrl(apiBase, preview.image_url) : null),
    [apiBase, preview]
  );

  return (
    <section className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-rose-100">
      {!preview ? (
        <div className="mt-2 rounded-lg bg-rose-50 p-3 text-rose-400">（まだ写真がありません）</div>
      ) : (
        <figure className="mt-2 overflow-hidden rounded-xl bg-white ring-1 ring-rose-100">
          <img
            src={imageSrc!}
            alt={preview.pictured_at ?? `seq=${preview.seq}`}
            className="block max-h-96 w-full bg-black/5 object-contain"
            loading="eager"
            decoding="async"
          />
          <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-rose-700">
            <span className="truncate">seq: {preview.seq}</span>
            <span className="rounded bg-rose-50 px-2 py-0.5">{preview.device_id}</span>
          </figcaption>
        </figure>
      )}
    </section>
  );
}
