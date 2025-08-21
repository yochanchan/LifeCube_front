// src/app/album/AlbumClient.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

/** YYYY-MM-DD → 「YYYY.MM.DD」 */
function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${y}.${m.toString().padStart(2, '0')}.${d.toString().padStart(2, '0')}`;
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
  const router = useRouter();

  // 認証チェック：未ログインなら /login へ（Hooks は常にトップレベルで宣言）
  const [me, setMe] = useState<{ account_id: number; email: string; role: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("unauth");
        const j = await res.json();
        if (!cancelled) setMe(j);
      } catch {
        if (!cancelled) router.replace(`/login?next=/album`);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const authReady = authChecked && !!me;

  // CSRでクエリを読む
  const searchParams = useSearchParams();
  const tripId = searchParams.get("trip_id"); // string | null

  /** 日付一覧（SWR）— 認証前は key を null にして発火させない */
  const datesKey = authReady ? endpoints.dates(tripId) : null;
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

  /** 写真一覧（選択日付が決まっており、かつ認証OKのときのみ） */
  const picsKey =
    authReady && selectedDate ? endpoints.byDate(selectedDate, tripId, DEFAULT_THUMB_W) : null;
  const {
    data: pictures = initial.pictures,
    error: errorPics,
    isLoading: loadingPics,
  } = useSWR<PictureMeta[] | undefined>(picsKey, fetcher, { fallbackData: initial.pictures });

  // スライドショー関連の状態
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlayInterval, setAutoPlayInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(true); // 自動再生の状態

  // スライドショー用のランダム日付と写真
  const [slideshowDate, setSlideshowDate] = useState<string | null>(null);
  const [slideshowPictures, setSlideshowPictures] = useState<PictureMeta[]>([]);

  // 利用可能な日付からランダムで1つ選択
  useEffect(() => {
    if (dates && dates.length > 0) {
      const randomDate = dates[Math.floor(Math.random() * dates.length)];
      setSlideshowDate(randomDate);
    }
  }, [dates]);

  // 選択された日付の写真を取得
  const slideshowPicsKey = authReady && slideshowDate ? endpoints.byDate(slideshowDate, tripId, 800) : null;
  const { data: allSlideshowPictures = [] } = useSWR<PictureMeta[]>(slideshowPicsKey, fetcher, { fallbackData: [] });

  // ランダムで10枚選択
  useEffect(() => {
    if (allSlideshowPictures.length > 0) {
      const shuffled = [...allSlideshowPictures].sort(() => Math.random() - 0.5);
      setSlideshowPictures(shuffled.slice(0, 10));
    }
  }, [allSlideshowPictures]);

  // スライドショーの自動再生/停止
  useEffect(() => {
    if (isPlaying && slideshowPictures.length > 0) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % slideshowPictures.length);
      }, 3000); // 3秒間隔
      setAutoPlayInterval(interval);
      return () => clearInterval(interval);
    } else if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      setAutoPlayInterval(null);
    }
  }, [isPlaying, slideshowPictures.length]);

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    return () => {
      if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
      }
    };
  }, [autoPlayInterval]);

  // スライドショーコントロール
  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // クイズ関連の状態
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState<string>("");
  const [quizAnswer, setQuizAnswer] = useState<string>("");
  const [quizChoices, setQuizChoices] = useState<string[]>([]);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [quizResult, setQuizResult] = useState<"correct" | "incorrect" | null>(null);

  // クイズを自動生成して開始
  const startQuiz = useCallback(() => {
    if (slideshowPictures.length > 0 && currentIndex < slideshowPictures.length) {
      const currentPicture = slideshowPictures[currentIndex];
      
      // 写真の情報からクイズを自動生成
      let question = "";
      let answer = "";
      let choices: string[] = [];
      
      if (currentPicture.user_comment) {
        // ユーザーコメントがある場合
        question = `この写真のコメントは何ですか？`;
        answer = currentPicture.user_comment;
        choices = [
          answer,
          "素晴らしい景色ですね",
          "楽しい時間でした",
          "思い出に残る一枚です"
        ];
      } else if (currentPicture.situation_for_quiz) {
        // 状況説明がある場合
        question = `この写真が撮影された状況は何ですか？`;
        answer = currentPicture.situation_for_quiz;
        choices = [
          answer,
          "家族旅行中",
          "友達との食事",
          "仕事の合間"
        ];
      } else if (currentPicture.device_id) {
        // デバイスIDがある場合
        question = `この写真は何というデバイスで撮影されましたか？`;
        answer = currentPicture.device_id;
        choices = [
          answer,
          "スマートフォン",
          "デジタルカメラ",
          "タブレット"
        ];
      } else {
        // 日時からクイズを生成
        const date = new Date(currentPicture.pictured_at);
        const hours = date.getHours();
        let timeOfDay = "";
        if (hours >= 5 && hours < 12) timeOfDay = "朝";
        else if (hours >= 12 && hours < 17) timeOfDay = "昼";
        else if (hours >= 17 && hours < 21) timeOfDay = "夕方";
        else timeOfDay = "夜";
        
        question = `この写真は何時頃に撮影されましたか？`;
        answer = timeOfDay;
        choices = ["朝", "昼", "夕方", "夜"];
      }
      
      // 選択肢をシャッフル
      const shuffledChoices = [...choices].sort(() => Math.random() - 0.5);
      
      setQuizQuestion(question);
      setQuizAnswer(answer);
      setQuizChoices(shuffledChoices);
      setUserAnswer("");
      setQuizResult(null);
      setShowQuiz(true);
    }
  }, [slideshowPictures, currentIndex]);

  // クイズを回答
  const submitQuiz = useCallback(() => {
    if (!userAnswer) {
      alert("選択肢を選んでください。");
      return;
    }
    
    const isCorrect = userAnswer === quizAnswer;
    setQuizResult(isCorrect ? "correct" : "incorrect");
  }, [userAnswer, quizAnswer]);

  // クイズを閉じる
  const closeQuiz = useCallback(() => {
    setShowQuiz(false);
    setQuizQuestion("");
    setQuizAnswer("");
    setQuizChoices([]);
    setUserAnswer("");
    setQuizResult(null);
  }, []);

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#BDD9D7' }}>
      {!authReady ? (
        <div className="min-h-[40vh] grid place-items-center">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-blue-100" style={{ color: '#2B578A' }}>
            認証確認中…
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* ヘッダー */}
          <header className="text-center mb-8">
            <h1 className="text-4xl mb-4" style={{ color: '#2B578A' }}>アルバム</h1>
          </header>

          {/* メインスライドショー */}
          {slideshowPictures.length > 0 && slideshowDate && (
            <section className="mb-8">
              <SlideShow
                pictures={slideshowPictures}
                currentIndex={currentIndex}
                totalCount={slideshowPictures.length}
                slideshowDate={slideshowDate}
                isPlaying={isPlaying}
                togglePlayPause={togglePlayPause}
                onStartQuiz={startQuiz}
                showQuiz={showQuiz}
                quizQuestion={quizQuestion}
                quizAnswer={quizAnswer}
                quizChoices={quizChoices}
                userAnswer={userAnswer}
                quizResult={quizResult}
                onUserAnswerChange={setUserAnswer}
                onSubmitQuiz={submitQuiz}
                onCloseQuiz={closeQuiz}
              />
            </section>
          )}

          {/* 日付セレクタ */}
          <section className="mb-8">
            <h2 className="text-lg mb-4" style={{ color: '#2B578A' }}>アルバム日付</h2>
            <DateChips
              dates={dates ?? []}
              loading={!!loadingDates}
              error={errorDates ? (errorDates as Error).message : null}
              selected={selectedDate}
              onSelect={setSelectedDate}
            />
          </section>

          {/* 写真グリッド（削除ボタン付き） */}
          <section className="mb-8">
            <h2 className="sr-only">写真一覧</h2>
            <PicturesGrid
              items={pictures ?? []}
              loading={!!loadingPics}
              error={errorPics ? (errorPics as Error).message : null}
              swrKey={picsKey}
            />
          </section>
        </div>
      )}
    </main>
  );
}

/* ───────────────────────────────────────────────────────────
   プレゼンテーション系コンポーネント
   ─────────────────────────────────────────────────────────── */

function SlideShow({
  pictures,
  currentIndex,
  totalCount,
  slideshowDate,
  isPlaying,
  togglePlayPause,
  onStartQuiz,
  showQuiz,
  quizQuestion,
  quizAnswer,
  quizChoices,
  userAnswer,
  quizResult,
  onUserAnswerChange,
  onSubmitQuiz,
  onCloseQuiz,
}: {
  pictures: PictureMeta[];
  currentIndex: number;
  totalCount: number;
  slideshowDate: string;
  isPlaying: boolean;
  togglePlayPause: () => void;
  onStartQuiz: () => void;
  showQuiz: boolean;
  quizQuestion: string;
  quizAnswer: string;
  quizChoices: string[];
  userAnswer: string;
  quizResult: "correct" | "incorrect" | null;
  onUserAnswerChange: (answer: string) => void;
  onSubmitQuiz: () => void;
  onCloseQuiz: () => void;
}) {
  const currentPicture = pictures[currentIndex];
  if (!currentPicture) return null;

  const thumbSrc = currentPicture.thumbnail_path
    ? `${API_BASE}${currentPicture.thumbnail_path.startsWith("/") ? "" : "/"}${currentPicture.thumbnail_path}`
    : endpoints.thumb(currentPicture.picture_id, 800);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-4xl mx-auto">
      {/* スライドショー日付表示 */}
      <div className="mb-4 flex items-center gap-3">
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
      <div className="bg-gray-100 rounded-xl aspect-video mb-6 flex items-center justify-center overflow-hidden">
        <img
          src={thumbSrc}
          alt={currentPicture.user_comment ?? currentPicture.situation_for_quiz ?? "写真"}
          className="w-full h-full object-cover"
        />
      </div>

      {/* 進捗表示 */}
      <div className="text-center mb-4">
        <span className="text-lg font-medium" style={{ color: '#2B578A' }}>
          {currentIndex + 1} / {totalCount}
        </span>
      </div>

      {/* プログレスバー */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ 
            width: `${((currentIndex + 1) / totalCount) * 100}%`,
            backgroundColor: '#2B578A'
          }}
        />
      </div>

      {/* コントロールボタン */}
      <div className="mt-6 flex justify-center gap-4">
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
      </div>

      {/* クイズ表示エリア */}
      {showQuiz && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <div className="mb-4">
            <h4 className="text-lg font-medium mb-2" style={{ color: '#2B578A' }}>クイズ</h4>
            <p className="text-base" style={{ color: '#2B578A' }}>{quizQuestion}</p>
          </div>

          {quizChoices.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {quizChoices.map((choice, index) => (
                <button
                  key={index}
                  onClick={() => onUserAnswerChange(choice)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    userAnswer === choice
                      ? "bg-blue-500 text-white"
                      : "bg-white ring-1 ring-blue-200 hover:bg-blue-50"
                  }`}
                  style={{
                    borderColor: '#2B578A',
                    '--tw-ring-color': '#2B578A'
                  } as React.CSSProperties}
                >
                  {choice}
                </button>
              ))}
            </div>
          )}

          {quizResult === null && (
            <div className="flex gap-3">
              <button
                onClick={onSubmitQuiz}
                className="flex-1 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                style={{ backgroundColor: '#2B578A' }}
              >
                回答する
              </button>
              <button
                onClick={onCloseQuiz}
                className="px-4 py-2 text-gray-600 font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                閉じる
              </button>
            </div>
          )}

          {quizResult === "correct" && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
              <p className="text-green-800 font-medium">正解です！🎉</p>
              <p className="text-green-700 text-sm mt-1">正解: {quizAnswer}</p>
              <button
                onClick={onCloseQuiz}
                className="mt-3 px-4 py-2 text-green-800 font-medium rounded-lg border border-green-300 hover:bg-green-100"
              >
                閉じる
              </button>
            </div>
          )}

          {quizResult === "incorrect" && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#FEE2E2' }}>
              <p className="text-red-800 font-medium">不正解です。もう一度挑戦してみてください。</p>
              <p className="text-red-700 text-sm mt-1">正解: {quizAnswer}</p>
              <button
                onClick={onCloseQuiz}
                className="mt-3 px-4 py-2 text-red-800 font-medium rounded-lg border border-red-300 hover:bg-red-100"
              >
                閉じる
              </button>
            </div>
          )}
        </div>
      )}
    </div>
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
                ? "shadow-md"
                : "bg-white ring-1 ring-blue-200 hover:bg-blue-50")
            }
            style={{ 
              color: active ? '#FFFFFF' : '#2B578A',
              backgroundColor: active ? '#2B578A' : undefined
            }}
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
  
  // 複数選択用の状態
  const [selectedPictures, setSelectedPictures] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

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

  // 複数写真の一括削除
  const doBulkDelete = async () => {
    if (!swrKey || selectedPictures.size === 0) return;
    setOpError(null);

    const ok = window.confirm(`選択された${selectedPictures.size}枚の写真を削除しますか？（元に戻せません）`);
    if (!ok) return;

    try {
      const deletePromises = Array.from(selectedPictures).map(async (id) => {
        const res = await fetch(endpoints.deletePicture(id), {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok && res.status !== 204) {
          const text = await res.text().catch(() => "");
          throw new Error(`写真ID ${id} の削除に失敗: ${res.status} ${res.statusText} ${text}`);
        }
        return id;
      });

      const deletedIds = await Promise.all(deletePromises);
      
      await mutate(
        swrKey,
        (prev: PictureMeta[] | undefined) => prev?.filter((x) => !deletedIds.includes(x.picture_id)),
        { revalidate: false }
      );

      setSelectedPictures(new Set());
      setIsSelectMode(false);
    } catch (e: any) {
      setOpError(e?.message ?? String(e));
    }
  };

  // 写真の選択/選択解除
  const togglePictureSelection = (pictureId: number) => {
    const newSelected = new Set(selectedPictures);
    if (newSelected.has(pictureId)) {
      newSelected.delete(pictureId);
    } else {
      newSelected.add(pictureId);
    }
    setSelectedPictures(newSelected);
  };

  // 全選択/全選択解除
  const toggleAllSelection = () => {
    if (selectedPictures.size === items.length) {
      setSelectedPictures(new Set());
    } else {
      setSelectedPictures(new Set(items.map(p => p.picture_id)));
    }
  };

  // 選択モードの切り替え
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) {
      setSelectedPictures(new Set());
    }
  };

  if (loading) return <SkeletonGrid />;
  if (error) return <ErrorBanner text={`エラー: ${error}`} />;
  if (!items || items.length === 0) return <EmptyBanner text="この日には写真がありません。" />;

  // 写真を配置用に分割
  const [firstPicture, secondPicture, thirdPicture, ...remainingPictures] = items;

  return (
    <>
      {opError && <ErrorBanner text={`エラー: ${opError}`} />}
      
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
            {isSelectMode ? "選択モード終了" : "複数選択"}
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
            onClick={doBulkDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            選択した写真を削除 ({selectedPictures.size})
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        {/* 左上: 大きな写真（2x2セル） */}
        {firstPicture && (
          <figure
            key={firstPicture.picture_id}
            className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 col-span-2 row-span-2"
          >
            {/* 選択チェックボックス */}
            {isSelectMode && (
              <div className="absolute left-2 top-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedPictures.has(firstPicture.picture_id)}
                  onChange={() => togglePictureSelection(firstPicture.picture_id)}
                  className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            )}

            <a
              href={endpoints.image(firstPicture.picture_id)}
              target="_blank"
              rel="noreferrer noopener"
              className="block h-full"
            >
              <img
                src={firstPicture.thumbnail_path
                  ? `${API_BASE}${firstPicture.thumbnail_path.startsWith("/") ? "" : "/"}${firstPicture.thumbnail_path}`
                  : endpoints.thumb(firstPicture.picture_id, DEFAULT_THUMB_W)}
                alt={firstPicture.user_comment ?? firstPicture.situation_for_quiz ?? firstPicture.pictured_at}
                className={
                  "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 " +
                  (deletingId === firstPicture.picture_id ? "opacity-40" : "")
                }
                loading="lazy"
                decoding="async"
              />
            </a>

            <button
              type="button"
              aria-label="削除"
              title="削除"
              disabled={deletingId === firstPicture.picture_id || !swrKey}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void doDelete(firstPicture.picture_id);
              }}
              className={
                "absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-blue-200 " +
                "text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              }
            >
              <span className="inline-block leading-none text-sm">✕</span>
            </button>

            <figcaption className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-2 text-xs">
              <div className="flex justify-end">
                <span className="font-medium" style={{ color: '#2B578A' }}>
                  {firstPicture.pictured_at.slice(11, 19)}
                </span>
              </div>
            </figcaption>
          </figure>
        )}

        {/* 右側: 小さな写真2つ */}
        {secondPicture && (
          <figure
            key={secondPicture.picture_id}
            className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 col-span-1 row-span-1"
          >
            {/* 選択チェックボックス */}
            {isSelectMode && (
              <div className="absolute left-2 top-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedPictures.has(secondPicture.picture_id)}
                  onChange={() => togglePictureSelection(secondPicture.picture_id)}
                  className="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            )}

            <a
              href={endpoints.image(secondPicture.picture_id)}
              target="_blank"
              rel="noreferrer noopener"
              className="block h-full"
            >
              <img
                src={secondPicture.thumbnail_path
                  ? `${API_BASE}${secondPicture.thumbnail_path.startsWith("/") ? "" : "/"}${secondPicture.thumbnail_path}`
                  : endpoints.thumb(secondPicture.picture_id, DEFAULT_THUMB_W)}
                alt={secondPicture.user_comment ?? secondPicture.situation_for_quiz ?? secondPicture.pictured_at}
                className={
                  "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 " +
                  (deletingId === secondPicture.picture_id ? "opacity-40" : "")
                }
                loading="lazy"
                decoding="async"
              />
            </a>

            <button
              type="button"
              aria-label="削除"
              title="削除"
              disabled={deletingId === secondPicture.picture_id || !swrKey}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void doDelete(secondPicture.picture_id);
              }}
              className={
                "absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-blue-200 " +
                "text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              }
            >
              <span className="inline-block leading-none text-sm">✕</span>
            </button>

            <figcaption className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-2 text-xs">
              <div className="flex justify-end">
                <span className="font-medium" style={{ color: '#2B578A' }}>
                  {secondPicture.pictured_at.slice(11, 19)}
                </span>
              </div>
            </figcaption>
          </figure>
        )}

        {thirdPicture && (
          <figure
            key={thirdPicture.picture_id}
            className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 col-span-1 row-span-1"
          >
            {/* 選択チェックボックス */}
            {isSelectMode && (
              <div className="absolute left-2 top-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedPictures.has(thirdPicture.picture_id)}
                  onChange={() => togglePictureSelection(thirdPicture.picture_id)}
                  className="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            )}

            <a
              href={endpoints.image(thirdPicture.picture_id)}
              target="_blank"
              rel="noreferrer noopener"
              className="block h-full"
            >
              <img
                src={thirdPicture.thumbnail_path
                  ? `${API_BASE}${thirdPicture.thumbnail_path.startsWith("/") ? "" : "/"}${thirdPicture.thumbnail_path}`
                  : endpoints.thumb(thirdPicture.picture_id, DEFAULT_THUMB_W)}
                alt={thirdPicture.user_comment ?? thirdPicture.situation_for_quiz ?? thirdPicture.pictured_at}
                className={
                  "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 " +
                  (deletingId === thirdPicture.picture_id ? "opacity-40" : "")
                }
                loading="lazy"
                decoding="async"
              />
            </a>

            <button
              type="button"
              aria-label="削除"
              title="削除"
              disabled={deletingId === thirdPicture.picture_id || !swrKey}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void doDelete(thirdPicture.picture_id);
              }}
              className={
                "absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-blue-200 " +
                "text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              }
            >
              <span className="inline-block leading-none text-sm">✕</span>
            </button>

            <figcaption className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-2 text-xs">
              <div className="flex justify-end">
                <span className="font-medium" style={{ color: '#2B578A' }}>
                  {thirdPicture.pictured_at.slice(11, 19)}
                </span>
              </div>
            </figcaption>
          </figure>
        )}

        {/* 下側: 小さな写真4つ */}
        {remainingPictures.slice(0, 4).map((p) => {
          const thumbSrc = p.thumbnail_path
            ? `${API_BASE}${p.thumbnail_path.startsWith("/") ? "" : "/"}${p.thumbnail_path}`
            : endpoints.thumb(p.picture_id, DEFAULT_THUMB_W);

          const isDeleting = deletingId === p.picture_id;

          return (
            <figure
              key={p.picture_id}
              className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 col-span-1 row-span-1"
            >
              {/* 選択チェックボックス */}
              {isSelectMode && (
                <div className="absolute left-2 top-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedPictures.has(p.picture_id)}
                    onChange={() => togglePictureSelection(p.picture_id)}
                    className="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              )}

              <a
                href={endpoints.image(p.picture_id)}
                target="_blank"
                rel="noreferrer noopener"
                className="block h-full"
              >
                <img
                  src={thumbSrc}
                  alt={p.user_comment ?? p.situation_for_quiz ?? p.pictured_at}
                  className={
                    "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 " +
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
                  "absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-blue-200 " +
                  "text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                }
              >
                <span className="inline-block leading-none text-sm">✕</span>
              </button>

              <figcaption className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-2 text-xs">
                <div className="flex justify-end">
                  <span className="font-medium" style={{ color: '#2B578A' }}>
                    {p.pictured_at.slice(11, 19)}
                  </span>
                </div>
              </figcaption>
            </figure>
          );
        })}

        {/* 左側: 小さな写真2つ */}
        {remainingPictures.slice(4, 6).map((p) => {
          const thumbSrc = p.thumbnail_path
            ? `${API_BASE}${p.thumbnail_path.startsWith("/") ? "" : "/"}${p.thumbnail_path}`
            : endpoints.thumb(p.picture_id, DEFAULT_THUMB_W);

          const isDeleting = deletingId === p.picture_id;

          return (
            <figure
              key={p.picture_id}
              className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 col-span-1 row-span-1"
            >
              {/* 選択チェックボックス */}
              {isSelectMode && (
                <div className="absolute left-2 top-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedPictures.has(p.picture_id)}
                    onChange={() => togglePictureSelection(p.picture_id)}
                    className="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              )}

              <a
                href={endpoints.image(p.picture_id)}
                target="_blank"
                rel="noreferrer noopener"
                className="block h-full"
              >
                <img
                  src={thumbSrc}
                  alt={p.user_comment ?? p.situation_for_quiz ?? p.pictured_at}
                  className={
                    "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 " +
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
                  "absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-blue-200 " +
                  "text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                }
              >
                <span className="inline-block leading-none text-sm">✕</span>
              </button>

              <figcaption className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-2 text-xs">
                <div className="flex justify-end">
                  <span className="font-medium" style={{ color: '#2B578A' }}>
                    {p.pictured_at.slice(11, 19)}
                  </span>
                </div>
              </figcaption>
            </figure>
          );
        })}

        {/* 右下: 大きな写真（2x2セル） */}
        {remainingPictures[6] && (
          <figure
            key={remainingPictures[6].picture_id}
            className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 col-span-2 row-span-2"
          >
            {/* 選択チェックボックス */}
            {isSelectMode && (
              <div className="absolute left-2 top-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedPictures.has(remainingPictures[6].picture_id)}
                  onChange={() => togglePictureSelection(remainingPictures[6].picture_id)}
                  className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            )}

            <a
              href={endpoints.image(remainingPictures[6].picture_id)}
              target="_blank"
              rel="noreferrer noopener"
              className="block h-full"
            >
              <img
                src={remainingPictures[6].thumbnail_path
                  ? `${API_BASE}${remainingPictures[6].thumbnail_path.startsWith("/") ? "" : "/"}${remainingPictures[6].thumbnail_path}`
                  : endpoints.thumb(remainingPictures[6].picture_id, DEFAULT_THUMB_W)}
                alt={remainingPictures[6].user_comment ?? remainingPictures[6].situation_for_quiz ?? remainingPictures[6].pictured_at}
                className={
                  "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 " +
                  (deletingId === remainingPictures[6].picture_id ? "opacity-40" : "")
                }
                loading="lazy"
                decoding="async"
              />
            </a>

            <button
              type="button"
              aria-label="削除"
              title="削除"
              disabled={deletingId === remainingPictures[6].picture_id || !swrKey}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void doDelete(remainingPictures[6].picture_id);
              }}
              className={
                "absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-blue-200 " +
                "text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              }
            >
              <span className="inline-block leading-none text-sm">✕</span>
            </button>

            <figcaption className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-2 text-xs">
              <div className="flex justify-end">
                <span className="font-medium" style={{ color: '#2B578A' }}>
                  {remainingPictures[6].pictured_at.slice(11, 19)}
                </span>
              </div>
            </figcaption>
          </figure>
        )}

        {/* 右下の大きな写真の下側: 小さな写真4つ */}
        {remainingPictures.slice(7, 11).map((p) => {
          const thumbSrc = p.thumbnail_path
            ? `${API_BASE}${p.thumbnail_path.startsWith("/") ? "" : "/"}${p.thumbnail_path}`
            : endpoints.thumb(p.picture_id, DEFAULT_THUMB_W);

          const isDeleting = deletingId === p.picture_id;

          return (
            <figure
              key={p.picture_id}
              className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 col-span-1 row-span-1"
            >
              {/* 選択チェックボックス */}
              {isSelectMode && (
                <div className="absolute left-2 top-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedPictures.has(p.picture_id)}
                    onChange={() => togglePictureSelection(p.picture_id)}
                    className="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              )}

              <a
                href={endpoints.image(p.picture_id)}
                target="_blank"
                rel="noreferrer noopener"
                className="block h-full"
              >
                <img
                  src={thumbSrc}
                  alt={p.user_comment ?? p.situation_for_quiz ?? p.pictured_at}
                  className={
                    "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 " +
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
                  "absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-blue-200 " +
                  "text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                }
              >
                <span className="inline-block leading-none text-sm">✕</span>
              </button>

              <figcaption className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-2 text-xs">
                <div className="flex justify-end">
                  <span className="font-medium" style={{ color: '#2B578A' }}>
                    {p.pictured_at.slice(11, 19)}
                  </span>
                </div>
              </figcaption>
            </figure>
          );
        })}

        {/* 残りの写真を通常のグリッドで表示 */}
        {remainingPictures.slice(11).map((p) => {
          const thumbSrc = p.thumbnail_path
            ? `${API_BASE}${p.thumbnail_path.startsWith("/") ? "" : "/"}${p.thumbnail_path}`
            : endpoints.thumb(p.picture_id, DEFAULT_THUMB_W);

          const isDeleting = deletingId === p.picture_id;

          return (
            <figure
              key={p.picture_id}
              className="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 col-span-1 row-span-1"
            >
              {/* 選択チェックボックス */}
              {isSelectMode && (
                <div className="absolute left-2 top-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedPictures.has(p.picture_id)}
                    onChange={() => togglePictureSelection(p.picture_id)}
                    className="w-4 h-4 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
              )}

              <a
                href={endpoints.image(p.picture_id)}
                target="_blank"
                rel="noreferrer noopener"
                className="block h-full"
              >
                <img
                  src={thumbSrc}
                  alt={p.user_comment ?? p.situation_for_quiz ?? p.pictured_at}
                  className={
                    "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 " +
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
                  "absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-blue-200 " +
                  "text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                }
              >
                <span className="inline-block leading-none text-sm">✕</span>
              </button>

              <figcaption className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-2 text-xs">
                <div className="flex justify-end">
                  <span className="font-medium" style={{ color: '#2B578A' }}>
                    {p.pictured_at.slice(11, 19)}
                  </span>
                </div>
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
