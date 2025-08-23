// src/app/album/UI.tsx
"use client";

import React, { useState } from "react";

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
   定数・ユーティリティ
   ─────────────────────────────────────────────────────────── */

/** API ベースURL（末尾の / を除去） */
const API_BASE_RAW = process.env.NEXT_PUBLIC_API_ENDPOINT;
const API_BASE = (API_BASE_RAW ?? "").replace(/\/+$/, "");

/** サムネイル幅のデフォルト値 */
const DEFAULT_THUMB_W = 256;

/** YYYY-MM-DD → 「YYYY年M月D日」 */
export function formatJP(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${y}年${m}月${d}日`;
  } catch {
    return dateStr;
  }
}

/** YYYY-MM-DD → 「YYYY.MM.DD」 */
export function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${y}.${m.toString().padStart(2, '0')}.${d.toString().padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

/* ───────────────────────────────────────────────────────────
   エンドポイント
   ─────────────────────────────────────────────────────────── */

export const endpoints = {
  dates: (tripId?: string | null) => {
    const params = new URLSearchParams();
    if (tripId) params.set("trip_id", tripId);
    const q = params.toString();
    return `${API_BASE}/api/pictures/dates${q ? `?${q}` : ""}`;
  },
  byDate: (date: string, tripId?: string | null, thumbW: number = DEFAULT_THUMB_W) => {
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
   プレゼンテーション系コンポーネント
   ─────────────────────────────────────────────────────────── */

export function DateChips({
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
  // Hooksを最上位で呼び出し
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // 選択された日付から年と月を取得
  React.useEffect(() => {
    if (selected) {
      const [year, month] = selected.split('-');
      setSelectedYear(year);
      setSelectedMonth(month);
    }
  }, [selected]);

  if (loading) return <SkeletonChips />;
  if (error) return <ErrorBanner text={`エラー: ${error}`} />;
  if (!dates || dates.length === 0) return <EmptyBanner text="まだ写真がありません。" />;

  // 日付を年、月、日付でグループ化
  const groupedDates = dates.reduce((acc, date) => {
    const [year, month, day] = date.split('-');
    if (!acc[year]) {
      acc[year] = {};
    }
    if (!acc[year][month]) {
      acc[year][month] = [];
    }
    acc[year][month].push(day);
    return acc;
  }, {} as Record<string, Record<string, string[]>>);

  const years = Object.keys(groupedDates).sort((a, b) => Number(b) - Number(a));
  const months = selectedYear ? Object.keys(groupedDates[selectedYear]).sort((a, b) => Number(a) - Number(b)) : [];
  const days = selectedYear && selectedMonth ? groupedDates[selectedYear][selectedMonth].sort((a, b) => Number(a) - Number(b)) : [];

  return (
    <div className="mt-3 space-y-3">
      {/* 年選択 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {years.map((year) => (
          <button
            key={year}
            onClick={() => {
              setSelectedYear(year);
              setSelectedMonth(null);
            }}
            className={
              "whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all " +
              (selectedYear === year
                ? "shadow-md"
                : "bg-white ring-1 ring-blue-200 hover:bg-blue-50")
            }
            style={{ 
              color: selectedYear === year ? '#FFFFFF' : '#2B578A',
              backgroundColor: selectedYear === year ? '#2B578A' : undefined
            }}
            aria-pressed={selectedYear === year}
            title={`${year}年`}
          >
            {year}年
          </button>
        ))}
      </div>

      {/* 月選択 */}
      {selectedYear && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {months.map((month) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(month)}
              className={
                "whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all " +
                (selectedMonth === month
                  ? "shadow-md"
                  : "bg-white ring-1 ring-blue-200 hover:bg-blue-50")
              }
              style={{ 
                color: selectedMonth === month ? '#FFFFFF' : '#2B578A',
                backgroundColor: selectedMonth === month ? '#2B578A' : undefined
              }}
              aria-pressed={selectedMonth === month}
              title={`${month}月`}
            >
              {month}月
            </button>
          ))}
        </div>
      )}

      {/* 日付選択 */}
      {selectedYear && selectedMonth && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((day) => {
            const fullDate = `${selectedYear}-${selectedMonth}-${day}`;
            const active = selected === fullDate;
            return (
              <button
                key={day}
                onClick={() => onSelect(fullDate)}
                className={
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all " +
                  (active
                    ? "shadow-md"
                    : "bg-white ring-1 ring-blue-200 hover:bg-blue-50")
                }
                style={{ 
                  color: active ? '#FFFFFF' : '#2B578A',
                  backgroundColor: active ? '#2B578A' : undefined
                }}
                aria-pressed={active}
                title={formatJP(fullDate)}
              >
                {day}日
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PicturesGrid({
  items,
  loading,
  error,
  swrKey,
  onPictureClick,
  onDeletePictures,
}: {
  items: PictureMeta[];
  loading: boolean;
  error: string | null;
  swrKey: string | null;
  onPictureClick: (picture: PictureMeta) => void;
  onDeletePictures: (pictureIds: number[]) => void;
}) {
  const [selectedPictures, setSelectedPictures] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  if (loading) return <SkeletonGrid />;
  if (error) return <ErrorBanner text={`エラー: ${error}`} />;
  if (!items || items.length === 0) return <EmptyBanner text="この日には写真がありません。" />;

  const togglePictureSelection = (pictureId: number) => {
    const newSelected = new Set(selectedPictures);
    if (newSelected.has(pictureId)) {
      newSelected.delete(pictureId);
    } else {
      newSelected.add(pictureId);
    }
    setSelectedPictures(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedPictures.size === items.length) {
      setSelectedPictures(new Set());
    } else {
      setSelectedPictures(new Set(items.map(p => p.picture_id)));
    }
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) {
      setSelectedPictures(new Set());
    }
  };

  const handleDelete = () => {
    if (selectedPictures.size > 0) {
      onDeletePictures(Array.from(selectedPictures));
      setSelectedPictures(new Set());
      setIsSelectMode(false);
    }
  };

  return (
    <div>
      {/* 選択モードコントロール */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectMode}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isSelectMode 
                ? "bg-blue-600 text-white" 
                : "bg-white text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50"
            }`}
          >
            {isSelectMode ? "選択モード終了" : "写真を選択"}
          </button>
          
          {isSelectMode && (
            <>
              <button
                onClick={toggleAllSelection}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {selectedPictures.size === items.length ? "全選択解除" : "全選択"}
              </button>
              
              <span className="text-sm text-gray-600">
                選択中: {selectedPictures.size} / {items.length}
              </span>
            </>
          )}
        </div>

        {isSelectMode && selectedPictures.size > 0 && (
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            選択した写真を削除 ({selectedPictures.size})
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {items.map((picture) => (
          <PictureItem
            key={picture.picture_id}
            picture={picture}
            swrKey={swrKey}
            onPictureClick={onPictureClick}
            isSelectMode={isSelectMode}
            isSelected={selectedPictures.has(picture.picture_id)}
            onToggleSelection={togglePictureSelection}
          />
        ))}
      </div>
    </div>
  );
}

function PictureItem({
  picture,
  swrKey,
  onPictureClick,
  isSelectMode,
  isSelected,
  onToggleSelection,
}: {
  picture: PictureMeta;
  swrKey: string | null;
  onPictureClick: (picture: PictureMeta) => void;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelection: (pictureId: number) => void;
}) {
  const thumbSrc = picture.thumbnail_path
    ? `${API_BASE}${picture.thumbnail_path.startsWith("/") ? "" : ""}${picture.thumbnail_path}`
    : endpoints.thumb(picture.picture_id, DEFAULT_THUMB_W);

  return (
    <figure className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 aspect-square cursor-pointer">
      <div
        onClick={() => onPictureClick(picture)}
        className="block h-full"
      >
        <img
          src={thumbSrc}
          alt={picture.user_comment ?? picture.situation_for_quiz ?? picture.pictured_at}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
      </div>
      {isSelectMode && (
        <div
          className={`absolute top-2 left-2 w-6 h-6 rounded-full transition-all duration-200 cursor-pointer ${
            isSelected
              ? "bg-red-500 text-white shadow-lg scale-110"
              : "bg-white text-gray-400 ring-2 ring-gray-300 hover:ring-blue-400 hover:text-blue-500"
          }`}
          onClick={(e) => {
            e.stopPropagation(); // クリックイベントを親要素に伝播させない
            onToggleSelection(picture.picture_id);
          }}
          aria-label={isSelected ? "選択解除" : "選択"}
        >
          <div className="w-full h-full flex items-center justify-center">
            {isSelected ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}
    </figure>
  );
}

/* ───────────────────────────────────────────────────────────
   UI 小コンポーネント
   ─────────────────────────────────────────────────────────── */

function SkeletonChips() {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-blue-100/70" />
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse rounded-2xl bg-blue-100/70" />
      ))}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return <div className="mt-3 rounded-xl bg-blue-100 p-3 text-blue-800">{text}</div>;
}

function EmptyBanner({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-xl bg-white p-3 text-blue-700 ring-1 ring-blue-100">
      {text}
    </div>
  );
}
