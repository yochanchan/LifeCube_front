// app/album/AlbumClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";

/* ───────────────────────────────────────────────────────────
   定数・ユーティリティ
   ─────────────────────────────────────────────────────────── */

/** API ベースURL（末尾の / を除去） */
const API_BASE_RAW = process.env.NEXT_PUBLIC_API_ENDPOINT;
const API_BASE = (API_BASE_RAW ?? "").replace(/\/+$/, "");

/** サムネイル幅のデフォルト値 */
const DEFAULT_THUMB_W = 256;

/** YYYY-MM-DD → 「YYYY年M月D日」 */
function formatJP(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${y}年${m}月${d}日`;
  } catch {
    return dateStr;
  }
}

/** SWR 用フェッチャ（毎回取得: no-store） */
const fetcher = <T,>(url: string) =>
  fetch(url, { cache: "no-store", credentials: "include" }).then((res) => {
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  });

/* ───────────────────────────────────────────────────────────
   型
   ─────────────────────────────────────────────────────────── */

export type PictureMeta = {
  picture_id: number;
  account_id: number;
  trip_id: number | null;
  pictured_at: string;
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
  thumbnail_path?: string;
};

/* ───────────────────────────────────────────────────────────
   エンドポイント
   ─────────────────────────────────────────────────────────── */

const endpoints = {
  dates: (tripId?: string | null) => {
    const params = new URLSearchParams();
    if (tripId) params.set("trip_id", tripId);
    const q = params.toString();
    return `${API_BASE}/api/pictures/dates${q ? `?${q}` : ""}`;
  },
  byDate: (
    date: string,
    tripId?: string | null,
    thumbW: number = DEFAULT_THUMB_W
  ) => {
    const params = new URLSearchParams({ date, thumb_w: String(thumbW) });
    if (tripId) params.set("trip_id", tripId);
    return `${API_BASE}/api/pictures/by-date?${params.toString()}`;
  },
  image: (id: number) => `${API_BASE}/api/pictures/${id}/image`,
  thumb: (id: number, w: number = DEFAULT_THUMB_W) =>
    `${API_BASE}/api/pictures/${id}/thumbnail?w=${w}`,
  deletePicture: (id: number) => `${API_BASE}/api/pictures/${id}`,
};

/* ───────────────────────────────────────────────────────────
   メインコンポーネント
   ─────────────────────────────────────────────────────────── */

export default function AlbumClient({
  initial,
}: {
  initial: {
    dates?: string[];
    selectedDate: string | null;
    pictures?: PictureMeta[];
  };
}) {
  // ← CSRでクエリを読む（方針B）
  const searchParams = useSearchParams();
  const tripId = searchParams.get("trip_id"); // string | null

  /** 日付一覧（SWR） */
  const datesKey = endpoints.dates(tripId);
  const {
    data: dates = initial.dates,
    error: errorDates,
    isLoading: loadingDates,
  } = useSWR<string[]>(datesKey, fetcher, { fallbackData: initial.dates });

  /** 選択日付（未決定なら最新日を自動選択） */
  const [selectedDate, setSelectedDate] = useState<string | null>(initial.selectedDate);
  useEffect(() => {
    if (!selectedDate && dates && dates.length > 0) {
      setSelectedDate(dates[dates.length - 1]); // 末尾 = 最新日
    }
  }, [dates, selectedDate]);

  /** 写真一覧（選択日付が決まっている場合のみ） */
  const picsKey = selectedDate ? endpoints.byDate(selectedDate, tripId, DEFAULT_THUMB_W) : null;
  const {
    data: pictures = initial.pictures,
    error: errorPics,
    isLoading: loadingPics,
  } = useSWR<PictureMeta[] | undefined>(picsKey, fetcher, { fallbackData: initial.pictures });

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <HeaderCute />

        {/* 日付セレクタ */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-rose-700">アルバム日付</h2>
          <DateChips
            dates={dates ?? []}
            loading={!!loadingDates}
            error={errorDates ? (errorDates as Error).message : null}
            selected={selectedDate}
            onSelect={setSelectedDate}
          />
        </section>

        {/* 写真グリッド（削除ボタン付き） */}
        <section className="mt-6">
          <h2 className="sr-only">写真一覧</h2>
          <PicturesGrid
            items={pictures ?? []}
            loading={!!loadingPics}
            error={errorPics ? (errorPics as Error).message : null}
            swrKey={picsKey}
          />
        </section>
      </div>
    </main>
  );
}

/* ───────────────────────────────────────────────────────────
   プレゼンテーション系コンポーネント
   ─────────────────────────────────────────────────────────── */

function HeaderCute() {
  return (
    <header className="flex items-center gap-3 rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-rose-100">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-rose-200 text-rose-800 shadow-inner">
        📷
      </span>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-rose-800">アルバム</h1>
        <p className="text-sm text-rose-500">JST基準で日付ごとの写真を表示します</p>
      </div>
      <Link
        href="/"
        className="ml-auto inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-white hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-300"
        aria-label="トップページへ"
      >
        <span>トップへ</span>
      </Link>
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
  if (loading) return <SkeletonChips />;
  if (error) return <ErrorBanner text={`エラー: ${error}`} />;
  if (!dates || dates.length === 0) return <EmptyBanner text="まだ写真がありません。" />;

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
  swrKey,
}: {
  items: PictureMeta[];
  loading: boolean;
  error: string | null;
  swrKey: string | null;
}) {
  const { mutate } = useSWRConfig();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const doDelete = async (id: number) => {
    if (!swrKey) return;
    setOpError(null);

    const ok = window.confirm("この写真を削除しますか？（元に戻せません）");
    if (!ok) return;

    setDeletingId(id);
    try {
      const res = await fetch(endpoints.deletePicture(id), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => "");
        throw new Error(`削除に失敗しました: ${res.status} ${res.statusText} ${text}`);
      }

      await mutate(
        swrKey,
        (prev: PictureMeta[] | undefined) => prev?.filter((x) => x.picture_id !== id),
        { revalidate: false }
      );
    } catch (e: any) {
      setOpError(e?.message ?? String(e));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <SkeletonGrid />;
  if (error) return <ErrorBanner text={`エラー: ${error}`} />;
  if (!items || items.length === 0) return <EmptyBanner text="この日には写真がありません。" />;

  return (
    <>
      {opError && <ErrorBanner text={`エラー: ${opError}`} />}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((p) => {
          const thumbSrc = p.thumbnail_path
            ? `${API_BASE}${p.thumbnail_path.startsWith("/") ? "" : "/"}${p.thumbnail_path}`
            : endpoints.thumb(p.picture_id, DEFAULT_THUMB_W);

          const isDeleting = deletingId === p.picture_id;

          return (
            <figure
              key={p.picture_id}
              className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-rose-100"
            >
              <a
                href={endpoints.image(p.picture_id)}
                target="_blank"
                rel="noreferrer noopener"
                className="block"
              >
                <img
                  src={thumbSrc}
                  alt={p.user_comment ?? p.situation_for_quiz ?? p.pictured_at}
                  className={
                    "aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105 " +
                    (isDeleting ? "opacity-40" : "")
                  }
                  loading="lazy"
                  decoding="async"
                />
              </a>

              <button
                type="button"
                aria-label="削除"
                title="削除"
                disabled={isDeleting || !swrKey}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void doDelete(p.picture_id);
                }}
                className={
                  "absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-rose-200 " +
                  "text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                }
              >
                <span className="inline-block leading-none text-sm">✕</span>
              </button>

              <figcaption className="flex items-center justify-between p-2 text-xs text-rose-700">
                <span className="truncate" title={p.pictured_at}>
                  {p.pictured_at.slice(11, 16)}
                </span>
                {p.device_id && (
                  <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-600">{p.device_id}</span>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}

/* ───────────────────────────────────────────────────────────
   UI 小コンポーネント
   ─────────────────────────────────────────────────────────── */

function SkeletonChips() {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-rose-100/70" />
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse rounded-2xl bg-rose-100/70" />
      ))}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return <div className="mt-3 rounded-xl bg-rose-100 p-3 text-rose-800">{text}</div>;
}

function EmptyBanner({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-xl bg-white p-3 text-rose-700 ring-1 ring-rose-100">
      {text}
    </div>
  );
}
