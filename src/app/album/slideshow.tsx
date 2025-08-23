// src/app/album/slideshow.tsx
"use client";

import React from "react";

// ハートの浮遊アニメーション用のスタイル
const heartAnimationStyle = `
  @keyframes float {
    0% {
      transform: translateY(100px) translateX(0px) rotate(0deg);
      opacity: 0;
    }
    10% {
      transform: translateY(80px) translateX(2px) rotate(36deg);
      opacity: 0.3;
    }
    20% {
      transform: translateY(60px) translateX(-1px) rotate(72deg);
      opacity: 0.6;
    }
    30% {
      transform: translateY(40px) translateX(3px) rotate(108deg);
      opacity: 0.8;
    }
    40% {
      transform: translateY(20px) translateX(-2px) rotate(144deg);
      opacity: 0.9;
    }
    50% {
      transform: translateY(0px) translateX(1px) rotate(180deg);
      opacity: 1;
    }
    60% {
      transform: translateY(-20px) translateX(-3px) rotate(216deg);
      opacity: 0.9;
    }
    70% {
      transform: translateY(-40px) translateX(2px) rotate(252deg);
      opacity: 0.8;
    }
    80% {
      transform: translateY(-60px) translateX(-1px) rotate(288deg);
      opacity: 0.6;
    }
    90% {
      transform: translateY(-80px) translateX(2px) rotate(324deg);
      opacity: 0.3;
    }
    100% {
      transform: translateY(-100px) translateX(0px) rotate(360deg);
      opacity: 0;
    }
  }
  
  .animate-float {
    animation: float 8s linear infinite;
  }

  @keyframes float2 {
    0% {
      transform: translateY(120px) translateX(0px) rotate(0deg);
      opacity: 0;
    }
    10% {
      transform: translateY(100px) translateX(-2px) rotate(36deg);
      opacity: 0.3;
    }
    20% {
      transform: translateY(80px) translateX(1px) rotate(72deg);
      opacity: 0.6;
    }
    30% {
      transform: translateY(60px) translateX(-3px) rotate(108deg);
      opacity: 0.8;
    }
    40% {
      transform: translateY(40px) translateX(2px) rotate(144deg);
      opacity: 0.9;
    }
    50% {
      transform: translateY(20px) translateX(-1px) rotate(180deg);
      opacity: 1;
    }
    60% {
      transform: translateY(0px) translateX(3px) rotate(216deg);
      opacity: 0.9;
    }
    70% {
      transform: translateY(-20px) translateX(-2px) rotate(252deg);
      opacity: 0.8;
    }
    80% {
      transform: translateY(-40px) translateX(1px) rotate(288deg);
      opacity: 0.6;
    }
    90% {
      transform: translateY(-60px) translateX(-3px) rotate(324deg);
      opacity: 0.3;
    }
    100% {
      transform: translateY(-80px) translateX(0px) rotate(360deg);
      opacity: 0;
    }
  }
  
  .animate-float2 {
    animation: float2 8s linear infinite;
  }

  @keyframes float3 {
    0% {
      transform: translateY(80px) translateX(0px) rotate(0deg);
      opacity: 0;
    }
    10% {
      transform: translateY(60px) translateX(3px) rotate(36deg);
      opacity: 0.3;
    }
    20% {
      transform: translateY(40px) translateX(-2px) rotate(72deg);
      opacity: 0.6;
    }
    30% {
      transform: translateY(20px) translateX(1px) rotate(108deg);
      opacity: 0.8;
    }
    40% {
      transform: translateY(0px) translateX(-3px) rotate(144deg);
      opacity: 0.9;
    }
    50% {
      transform: translateY(-20px) translateX(2px) rotate(180deg);
      opacity: 1;
    }
    60% {
      transform: translateY(-40px) translateX(-1px) rotate(216deg);
      opacity: 0.9;
    }
    70% {
      transform: translateY(-60px) translateX(3px) rotate(252deg);
      opacity: 0.8;
    }
    80% {
      transform: translateY(-80px) translateX(-2px) rotate(288deg);
      opacity: 0.6;
    }
    90% {
      transform: translateY(-100px) translateX(1px) rotate(324deg);
      opacity: 0.3;
    }
    100% {
      transform: translateY(-120px) translateX(0px) rotate(360deg);
      opacity: 0;
    }
  }
  
  .animate-float3 {
    animation: float3 8s linear infinite;
  }
`;

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

/** API ベースURL（末尾の / を除去） */
const API_BASE_RAW = process.env.NEXT_PUBLIC_API_ENDPOINT;
const API_BASE = (API_BASE_RAW ?? "").replace(/\/+$/, "");

/** YYYY-MM-DD → 「YYYY.MM.DD」 */
function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${y}.${m.toString().padStart(2, '0')}.${d.toString().padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

export function SlideShow({
  pictures,
  currentIndex,
  totalCount,
  slideshowDate,
  isPlaying,
  togglePlayPause,
  onStartQuiz,
  onGoToAlbum,
  children,
}: {
  pictures: PictureMeta[];
  currentIndex: number;
  totalCount: number;
  slideshowDate: string;
  isPlaying: boolean;
  togglePlayPause: () => void;
  onStartQuiz: () => void;
  onGoToAlbum: () => void;
  children?: React.ReactNode;
}) {
  const currentPicture = pictures[currentIndex];
  if (!currentPicture) return null;

  const thumbSrc = currentPicture.thumbnail_path
    ? `${API_BASE}${currentPicture.thumbnail_path.startsWith("/") ? "" : "/"}${currentPicture.thumbnail_path}`
    : `${API_BASE}/api/pictures/${currentPicture.picture_id}/thumbnail?w=800`;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-4xl mx-auto relative overflow-hidden">
      {/* ハートアニメーション用のCSS */}
      <style dangerouslySetInnerHTML={{ __html: heartAnimationStyle }} />
      
      {/* 背景のハートアニメーション */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => {
          const animationClass = i % 3 === 0 ? 'animate-float' : i % 3 === 1 ? 'animate-float2' : 'animate-float3';
          const baseDelay = (i % 3) * 0.5;
          const randomDelay = Math.random() * 2;
          const totalDelay = baseDelay + randomDelay;
          
          return (
            <div
              key={i}
              className={`absolute text-pink-300 opacity-60 ${animationClass}`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${totalDelay}s`,
                fontSize: `${14 + Math.random() * 20}px`,
                filter: `hue-rotate(${Math.random() * 60}deg)`,
              }}
            >
              ❤
            </div>
          );
        })}
      </div>

      {/* スライドショー日付表示 */}
      <div className="mb-4 flex items-center gap-3 relative z-10">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#2B578A' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium" style={{ color: '#2B578A' }}>
          過去の思い出: {formatDate(slideshowDate)}
        </h3>
      </div>

      {/* メイン画像表示エリア */}
      <div className="bg-gray-100 rounded-xl aspect-video mb-6 flex items-center justify-center overflow-hidden relative z-10">
        <img
          src={thumbSrc}
          alt={currentPicture.user_comment ?? currentPicture.situation_for_quiz ?? "写真"}
          className="w-full h-full object-cover"
        />
      </div>

      {/* 進捗表示 */}
      <div className="text-center mb-4 relative z-10">
        <span className="text-lg font-medium" style={{ color: '#2B578A' }}>
          {currentIndex + 1} / {totalCount}
        </span>
      </div>

      {/* コントロールボタン */}
      <div className="mt-6 flex justify-center gap-4 relative z-10">
        <button
          onClick={togglePlayPause}
          className="text-white px-6 py-2 rounded-full font-medium transition-colors"
          style={{ backgroundColor: '#2B578A' }}
          aria-label={isPlaying ? "スライドショーを停止" : "スライドショーを再生"}
        >
          {isPlaying ? "停止" : "再生"}
        </button>
        <button
          onClick={onStartQuiz}
          className="text-white px-6 py-2 rounded-full font-medium transition-colors"
          style={{ backgroundColor: '#2B578A' }}
          aria-label="クイズを開始"
        >
          クイズ
        </button>
        <button
          onClick={onGoToAlbum}
          className="text-white px-6 py-2 rounded-full font-medium transition-colors"
          style={{ backgroundColor: '#2B578A' }}
          aria-label="この日のアルバム"
        >
          この日のアルバム
        </button>
      </div>

      {/* クイズ表示エリア */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
