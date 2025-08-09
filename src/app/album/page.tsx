"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// --- API base (proxy or backend origin) ---
// Set NEXT_PUBLIC_API_ENDPOINT in .env.local if your FastAPI runs on another origin.
const API_BASE_RAW = process.env.NEXT_PUBLIC_API_ENDPOINT;
// Normalize: empty string if undefined, and strip trailing slashes to avoid double //
const API_BASE = (API_BASE_RAW ?? "").replace(/\/+$/, "");

// For PoC: account_id を localStorage or .env から取得（未設定 = 全件）
function getAccountId(): string | null {
  if (typeof window !== "undefined") {
    const fromLS = window.localStorage.getItem("account_id");
    if (fromLS) return fromLS;
  }
  const fromEnv = process.env.NEXT_PUBLIC_ACCOUNT_ID;
  return fromEnv ?? null;
}

// --- Types ---
export type PictureMeta = {
  picture_id: number;
  account_id: number;
  trip_id: number | null;
  pictured_at: string; // "YYYY-MM-DD HH:mm:ss[.ffffff]" (JST)
  gps_lat: number | null;
  gps_lng: number | null;
  device_id: string | null;
  speech: string | null;
  situation_for_quiz: string | null;
  user_comment: string | null;
  content_type: string;
  image_size: number;
  sha256_hex: string | null;
  created_at: string;
  thumbnail_path?: string; // provided by backend; optional fallback used if absent
};

// Small helper to format date nicely in JP
const formatJP = (d: string) => {
  try {
    const [y, m, dd] = d.split("-").map(Number);
    return `${y}年${m}月${dd}日`;
  } catch {
    return d;
  }
};

// Fetch wrapper (no-cache)
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// Endpoints (FastAPI routes) — account_id は任意
const endpoints = {
  dates: (accountId?: string | null, tripId?: string | null) => {
    const params = new URLSearchParams();
    if (accountId) params.set("account_id", accountId);
    if (tripId) params.set("trip_id", tripId);
    const q = params.toString();
    return `${API_BASE}/api/pictures/dates${q ? `?${q}` : ""}`;
  },
  byDate: (date: string, accountId?: string | null, tripId?: string | null, thumbW = 256) => {
    const params = new URLSearchParams({ date, thumb_w: String(thumbW) });
    if (accountId) params.set("account_id", accountId);
    if (tripId) params.set("trip_id", tripId);
    return `${API_BASE}/api/pictures/by-date?${params.toString()}`;
  },
  image: (id: number) => `${API_BASE}/api/pictures/${id}/image`,
  thumb: (id: number, w = 256) => `${API_BASE}/api/pictures/${id}/thumbnail?w=${w}`,
};

export default function AlbumPage() {
  const sp = useSearchParams();
  const tripId = sp.get("trip_id"); // optional
  const [accountId, setAccountId] = useState<string | null>(null);

  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loadingDates, setLoadingDates] = useState(true);
  const [errorDates, setErrorDates] = useState<string | null>(null);

  const [pictures, setPictures] = useState<PictureMeta[]>([]);
  const [loadingPics, setLoadingPics] = useState(false);
  const [errorPics, setErrorPics] = useState<string | null>(null);

  // resolve account_id on mount（未設定でもOK = 全件）
  useEffect(() => {
    setAccountId(getAccountId());
  }, []);

  // Load available dates (JST-based) when accountId or tripId changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingDates(true);
      setErrorDates(null);
      try {
        const list = await fetchJSON<string[]>(endpoints.dates(accountId, tripId));
        if (!mounted) return;
        setDates(list);
        // Default select the latest date if available
        if (list.length > 0) setSelectedDate((prev) => prev ?? list[list.length - 1]);
      } catch (e: any) {
        if (!mounted) return;
        setErrorDates(e?.message ?? String(e));
      } finally {
        if (mounted) setLoadingDates(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [accountId, tripId]);

  // Load pictures for selected date
  useEffect(() => {
    if (!selectedDate) return;
    let mounted = true;
    (async () => {
      setLoadingPics(true);
      setErrorPics(null);
      try {
        const metas = await fetchJSON<PictureMeta[]>(
          endpoints.byDate(selectedDate, accountId, tripId, 256)
        );
        if (!mounted) return;
        setPictures(metas);
      } catch (e: any) {
        if (!mounted) return;
        setErrorPics(e?.message ?? String(e));
      } finally {
        if (mounted) setLoadingPics(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedDate, accountId, tripId]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <HeaderCute />

        {/* Date selector */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-rose-700">アルバム日付</h2>
          <DateChips
            dates={dates}
            loading={loadingDates}
            error={errorDates}
            selected={selectedDate}
            onSelect={setSelectedDate}
          />
        </section>

        {/* Pictures grid */}
        <section className="mt-6">
          <h2 className="sr-only">写真一覧</h2>
          <PicturesGrid items={pictures} loading={loadingPics} error={errorPics} />
        </section>
      </div>
    </main>
  );
}

function HeaderCute() {
  return (
    <header className="flex items-center gap-3 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-rose-100">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-200 text-rose-800 shadow-inner">📷</span>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-rose-800">アルバム</h1>
        <p className="text-sm text-rose-500">JST基準で日付ごとの写真を表示します</p>
      </div>
    </header>
  );
}

function DateChips({
  dates,
  loading,
  error,
  selected,
  onSelect,
}: {
  dates: string[];
  loading: boolean;
  error: string | null;
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  if (loading) {
    return (
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-rose-100/70" />
        ))}
      </div>
    );
  }
  if (error) {
    return <div className="mt-3 rounded-xl bg-rose-100 p-3 text-rose-800">エラー: {error}</div>;
  }
  if (dates.length === 0) {
    return (
      <div className="mt-3 rounded-xl bg-white p-3 text-rose-700 ring-1 ring-rose-100">
        まだ写真がありません。
      </div>
    );
  }
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
      {dates.map((d) => {
        const active = selected === d;
        return (
          <button
            key={d}
            onClick={() => onSelect(d)}
            className={
              "whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all " +
              (active
                ? "bg-rose-500 text-white shadow-md"
                : "bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50")
            }
            aria-pressed={active}
            title={d}
          >
            {formatJP(d)}
          </button>
        );
      })}
    </div>
  );
}

function PicturesGrid({
  items,
  loading,
  error,
}: {
  items: PictureMeta[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-2xl bg-rose-100/70" />
        ))}
      </div>
    );
  }
  if (error) {
    return <div className="mt-3 rounded-xl bg-rose-100 p-3 text-rose-800">エラー: {error}</div>;
  }
  if (items.length === 0) {
    return (
      <div className="mt-3 rounded-xl bg-white p-6 text-center text-rose-700 ring-1 ring-rose-100">
        この日には写真がありません。
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((p) => {
        // Safe join for API_BASE + thumbnail_path (avoid double slashes)
        const thumbSrc = p.thumbnail_path
          ? `${API_BASE}${p.thumbnail_path.startsWith("/") ? "" : "/"}${p.thumbnail_path}`
          : endpoints.thumb(p.picture_id, 256);
        return (
          <figure
            key={p.picture_id}
            className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rose-100"
          >
            <a href={endpoints.image(p.picture_id)} target="_blank" rel="noreferrer noopener" className="block">
              {/* Prefer backend-provided thumbnail path when available */}
              <img
                src={thumbSrc}
                alt={p.user_comment ?? p.situation_for_quiz ?? p.pictured_at}
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
            </a>
            <figcaption className="flex items-center justify-between p-2 text-xs text-rose-700">
              <span className="truncate" title={p.pictured_at}>
                {p.pictured_at.slice(11, 16)} {/* HH:mm */}
              </span>
              {p.device_id && <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-600">{p.device_id}</span>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
