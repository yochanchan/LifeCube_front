// src/app/components/AuthImage.tsx
"use client";

import React, { useEffect, useState } from "react";
import { apiclient } from "@/lib/apiclient";

export default function AuthImage({
  path, // 例: "/api/pictures/123/thumbnail?w=256"
  alt,
  className,
  loading = "lazy",
  decoding = "async",
  onError,
}: {
  path: string;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
  decoding?: "sync" | "async" | "auto";
  onError?: (e: unknown) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const u = await apiclient.getObjectUrl(path);
        if (!alive) return;
        objectUrl = u;
        setUrl(u);
      } catch (e) {
        onError?.(e);
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, onError]);

  if (!url) return <div className={className} aria-busy="true" />;

  return <img src={url} alt={alt} className={className} loading={loading} decoding={decoding} />;
}
