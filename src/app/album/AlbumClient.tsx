// src/app/album/AlbumClient.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { apiclient } from "@/lib/apiclient";

/* ───────────────────────────────────────────────────────────
   定数・ユーティリティ
   ─────────────────────────────────────────────────────────── */

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
    return `${y}.${m.toString().padStart(2, "0")}.${d.toString().padStart(2, "0")}`;
  } catch {
    return dateStr;
  }
}

/** SWR 用フェッチャ（apiclient経由） */
const fetcherJSON = <T,>(path: string) => apiclient.getJSON<T>(path);

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
   エンドポイント（path だけ返す）
   ─────────────────────────────────────────────────────────── */

const endpoints = {
  dates: (tripId?: string | null) => {
    const params = new URLSearchParams();
    if (tripId) params.set("trip_id", tripId);
    const q = params.toString();
    return `/api/pictures/dates${q ? `?${q}` : ""}`;
  },
  byDate: (date: string, tripId?: string | null, thumbW: number = DEFAULT_THUMB_W) => {
    const params = new URLSearchParams({ date, thumb_w: String(thumbW) });
    if (tripId) params.set("trip_id", tripId);
    return `/api/pictures/by-date?${params.toString()}`;
  },
  imagePath: (id: number) => `/api/pictures/${id}/image`,
  thumbPath: (id: number, w: number = DEFAULT_THUMB_W) =>
    `/api/pictures/${id}/thumbnail?w=${w}`,
  deletePicture: (id: number) => `/api/pictures/${id}`,
};

/* ───────────────────────────────────────────────────────────
   画像（認証付）ローダ
   ─────────────────────────────────────────────────────────── */

function AuthImg({
  path,
  alt,
  className,
  onLoaded,
}: {
  path: string;
  alt: string;
  className?: string;
  onLoaded?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;

    (async () => {
      try {
        const url = await apiclient.getObjectUrl(path);
        if (!cancelled) {
          currentUrl = url;
          setSrc(url);
          onLoaded?.();
        }
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
    // 依存は path のみに限定（関数 onLoaded は呼ぶが依存に入れない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (!src) {
    return <div className="w-full h-full bg-gray-100 animate-pulse" aria-label="loading image" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}

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

  // 認証チェック：未ログインなら /login へ
  const [me, setMe] = useState<{ account_id: number; email: string; role: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await apiclient.getJSON<{ account_id: number; email: string; role: string }>(
          "/auth/me"
        );
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
  const tripId = searchParams.get("trip_id");

  /** 日付一覧（SWR）— 認証前は key を null にして発火させない */
  const datesKey = authReady ? endpoints.dates(tripId) : null;
  const {
    data: dates = initial.dates,
    error: errorDates,
    isLoading: loadingDates,
  } = useSWR<string[]>(datesKey, fetcherJSON, { fallbackData: initial.dates });

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
  } = useSWR<PictureMeta[] | undefined>(picsKey, fetcherJSON, { fallbackData: initial.pictures });

  // スライドショー関連の状態
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true); // 自動再生の状態
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null); // ← stateからrefへ

  // スライドショー用のランダム日付と写真
  const [slideshowDate, setSlideshowDate] = useState<string | null>(null);
  const [slideshowPictures, setSlideshowPictures] = useState<PictureMeta[]>([]);

  useEffect(() => {
    if (dates && dates.length > 0) {
      const randomDate = dates[Math.floor(Math.random() * dates.length)];
      setSlideshowDate(randomDate);
    }
  }, [dates]);

  const slideshowPicsKey =
    authReady && slideshowDate ? endpoints.byDate(slideshowDate, tripId, 800) : null;
  const { data: allSlideshowPictures = [] } = useSWR<PictureMeta[]>(
    slideshowPicsKey,
    fetcherJSON,
    { fallbackData: [] }
  );

  useEffect(() => {
    if (allSlideshowPictures.length > 0) {
      const shuffled = [...allSlideshowPictures].sort(() => Math.random() - 0.5);
      setSlideshowPictures(shuffled.slice(0, 10));
      setCurrentIndex(0); // ソースが変わったらインデックス初期化
    }
  }, [allSlideshowPictures]);

  // ✅ タイマーは ref で管理。依存は isPlaying と 枚数だけ。
  useEffect(() => {
    // 既存のインターバルをクリア
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }

    if (isPlaying && slideshowPictures.length > 0) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % slideshowPictures.length);
      }, 3000);
    }

    // クリーンアップ
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
  }, [isPlaying, slideshowPictures.length]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((v) => !v);
  }, []);

  // クイズ関連
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState<string>("");
  const [quizAnswer, setQuizAnswer] = useState<string>("");
  const [quizChoices, setQuizChoices] = useState<string[]>([]);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [quizResult, setQuizResult] = useState<"correct" | "incorrect" | null>(null);

  const startQuiz = useCallback(() => {
    if (slideshowPictures.length > 0 && currentIndex < slideshowPictures.length) {
      const currentPicture = slideshowPictures[currentIndex];

      let question = "";
      let answer = "";
      let choices: string[] = [];

      if (currentPicture.user_comment) {
        question = `この写真のコメントは何ですか？`;
        answer = currentPicture.user_comment;
        choices = [answer, "素晴らしい景色ですね", "楽しい時間でした", "思い出に残る一枚です"];
      } else if (currentPicture.situation_for_quiz) {
        question = `この写真が撮影された状況は何ですか？`;
        answer = currentPicture.situation_for_quiz;
        choices = [answer, "家族旅行中", "友達との食事", "仕事の合間"];
      } else if (currentPicture.device_id) {
        question = `この写真は何というデバイスで撮影されましたか？`;
        answer = currentPicture.device_id;
        choices = [answer, "スマートフォン", "デジタルカメラ", "タブレット"];
      } else {
        const date = new Date(currentPicture.pictured_at);
        const hours = date.getHours();
        const timeOfDay =
          hours >= 5 && hours < 12 ? "朝" : hours < 17 ? "昼" : hours < 21 ? "夕方" : "夜";
        question = `この写真は何時頃に撮影されましたか？`;
        answer = timeOfDay;
        choices = ["朝", "昼", "夕方", "夜"];
      }

      const shuffledChoices = [...choices].sort(() => Math.random() - 0.5);

      setQuizQuestion(question);
      setQuizAnswer(answer);
      setQuizChoices(shuffledChoices);
      setUserAnswer("");
      setQuizResult(null);
      setShowQuiz(true);
    }
  }, [slideshowPictures, currentIndex]);

  const submitQuiz = useCallback(() => {
    if (!userAnswer) {
      alert("選択肢を選んでください。");
      return;
    }
    const isCorrect = userAnswer === quizAnswer;
    setQuizResult(isCorrect ? "correct" : "incorrect");
  }, [userAnswer, quizAnswer]);

  const closeQuiz = useCallback(() => {
    setShowQuiz(false);
    setQuizQuestion("");
    setQuizAnswer("");
    setQuizChoices([]);
    setUserAnswer("");
    setQuizResult(null);
  }, []);

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#BDD9D7" }}>
      {!authReady ? (
        <div className="min-h-[40vh] grid place-items-center">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-blue-100" style={{ color: "#2B578A" }}>
            認証確認中…
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* ヘッダー */}
          <header className="text-center mb-8">
            <h1 className="text-4xl mb-4" style={{ color: "#2B578A" }}>
              アルバム
            </h1>
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
            <h2 className="text-lg mb-4" style={{ color: "#2B578A" }}>
              アルバム日付
            </h2>
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

  const thumbPath = currentPicture.thumbnail_path
    ? currentPicture.thumbnail_path
    : endpoints.thumbPath(currentPicture.picture_id, 800);

  const openImage = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const path = endpoints.imagePath(currentPicture.picture_id);
      const url = await apiclient.getObjectUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [currentPicture?.picture_id]
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-4xl mx-auto">
      {/* スライドショー日付表示 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#2B578A" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium" style={{ color: "#2B578A" }}>
          過去の思い出: {formatDate(slideshowDate)}
        </h3>
      </div>

      {/* メイン画像表示エリア */}
      <a href="#" onClick={openImage} className="block">
        <div className="bg-gray-100 rounded-xl aspect-video mb-6 flex items-center justify-center overflow-hidden">
          <AuthImg
            path={thumbPath}
            alt={currentPicture.user_comment ?? currentPicture.situation_for_quiz ?? "写真"}
            className="w-full h-full object-cover"
          />
        </div>
      </a>

      {/* 進捗表示 */}
      <div className="text-center mb-4">
        <span className="text-lg font-medium" style={{ color: "#2B578A" }}>
          {currentIndex + 1} / {totalCount}
        </span>
      </div>

      {/* プログレスバー */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: `${((currentIndex + 1) / totalCount) * 100}%`,
            backgroundColor: "#2B578A",
          }}
        />
      </div>

      {/* コントロールボタン */}
      <div className="mt-6 flex justify-center gap-4">
        <button
          onClick={togglePlayPause}
          className="text-white px-6 py-2 rounded-full font-medium transition-colors"
          style={{ backgroundColor: "#2B578A" }}
          aria-label={isPlaying ? "スライドショーを停止" : "スライドショーを再生"}
        >
          {isPlaying ? "停止" : "再生"}
        </button>
        <button
          onClick={onStartQuiz}
          className="text-white px-6 py-2 rounded-full font-medium transition-colors"
          style={{ backgroundColor: "#2B578A" }}
          aria-label="クイズを開始"
        >
          クイズ
        </button>
      </div>

      {/* クイズ表示エリア */}
      {showQuiz && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl">
          <div className="mb-4">
            <h4 className="text-lg font-medium mb-2" style={{ color: "#2B578A" }}>
              クイズ
            </h4>
            <p className="text-base" style={{ color: "#2B578A" }}>
              {quizQuestion}
            </p>
          </div>

          {quizChoices.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              {quizChoices.map((choice, index) => (
                <button
                  key={index}
                  onClick={() => onUserAnswerChange(choice)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${userAnswer === choice ? "bg-blue-500 text-white" : "bg-white ring-1 ring-blue-200 hover:bg-blue-50"
                    }`}
                  style={{ borderColor: "#2B578A", ["--tw-ring-color" as any]: "#2B578A" }}
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
                style={{ backgroundColor: "#2B578A" }}
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
            <div className="p-3 rounded-lg" style={{ backgroundColor: "#D1FAE5" }}>
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
            <div className="p-3 rounded-lg" style={{ backgroundColor: "#FEE2E2" }}>
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
              (active ? "shadow-md" : "bg-white ring-1 ring-blue-200 hover:bg-blue-50")
            }
            style={{
              color: active ? "#FFFFFF" : "#2B578A",
              backgroundColor: active ? "#2B578A" : undefined,
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

  // 選択系
  const [selectedPictures, setSelectedPictures] = useState<Set<number>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  const doDelete = async (id: number) => {
    if (!swrKey) return;
    setOpError(null);

    const ok = window.confirm("この写真を削除しますか？（元に戻せません）");
    if (!ok) return;

    setDeletingId(id);
    try {
      await apiclient.del(endpoints.deletePicture(id));
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

  const doBulkDelete = async () => {
    if (!swrKey || selectedPictures.size === 0) return;
    setOpError(null);

    const ok = window.confirm(`選択された${selectedPictures.size}枚の写真を削除しますか？（元に戻せません）`);
    if (!ok) return;

    try {
      const ids = Array.from(selectedPictures);
      await Promise.all(ids.map((id) => apiclient.del(endpoints.deletePicture(id))));
      await mutate(
        swrKey,
        (prev: PictureMeta[] | undefined) => prev?.filter((x) => !selectedPictures.has(x.picture_id)),
        { revalidate: false }
      );
      setSelectedPictures(new Set());
      setIsSelectMode(false);
    } catch (e: any) {
      setOpError(e?.message ?? String(e));
    }
  };

  const togglePictureSelection = (pictureId: number) => {
    const newSelected = new Set(selectedPictures);
    newSelected.has(pictureId) ? newSelected.delete(pictureId) : newSelected.add(pictureId);
    setSelectedPictures(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedPictures.size === items.length) setSelectedPictures(new Set());
    else setSelectedPictures(new Set(items.map((p) => p.picture_id)));
  };

  const toggleSelectMode = () => {
    setIsSelectMode((v) => !v);
    if (isSelectMode) setSelectedPictures(new Set());
  };

  const openImageInNewTab = useCallback(async (e: React.MouseEvent, pictureId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const url = await apiclient.getObjectUrl(endpoints.imagePath(pictureId));
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  if (loading) return <SkeletonGrid />;
  if (error) return <ErrorBanner text={`エラー: ${error}`} />;
  if (!items || items.length === 0) return <EmptyBanner text="この日には写真がありません。" />;

  const [firstPicture, secondPicture, thirdPicture, ...remainingPictures] = items;

  const Thumb = ({ p, large = false }: { p: PictureMeta; large?: boolean }) => {
    const isDeleting = deletingId === p.picture_id;
    const thumbPath = p.thumbnail_path ?? endpoints.thumbPath(p.picture_id, DEFAULT_THUMB_W);
    return (
      <figure
        key={p.picture_id}
        className={
          "group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100 " +
          (large ? "col-span-2 row-span-2" : "col-span-1 row-span-1")
        }
      >
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
          href="#"
          onClick={(e) => openImageInNewTab(e, p.picture_id)}
          className="block h-full"
          aria-label="フル画像を新規タブで開く"
        >
          <AuthImg
            path={thumbPath}
            alt={p.user_comment ?? p.situation_for_quiz ?? p.pictured_at}
            className={
              "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 " +
              (isDeleting ? "opacity-40" : "")
            }
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
            <span className="font-medium" style={{ color: "#2B578A" }}>
              {p.pictured_at.slice(11, 19)}
            </span>
          </div>
        </figcaption>
      </figure>
    );
  };

  return (
    <>
      {opError && <ErrorBanner text={`エラー: ${opError}`} />}

      {/* 選択モードコントロール */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectMode}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${isSelectMode ? "bg-blue-600 text-white" : "bg-white text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50"
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
        {firstPicture && <Thumb p={firstPicture} large />}
        {secondPicture && <Thumb p={secondPicture} />}
        {thirdPicture && <Thumb p={thirdPicture} />}

        {remainingPictures.slice(0, 4).map((p) => <Thumb key={p.picture_id} p={p} />)}
        {remainingPictures.slice(4, 6).map((p) => <Thumb key={p.picture_id} p={p} />)}
        {remainingPictures[6] && <Thumb p={remainingPictures[6]} large />}
        {remainingPictures.slice(7, 11).map((p) => <Thumb key={p.picture_id} p={p} />)}
        {remainingPictures.slice(11).map((p) => <Thumb key={p.picture_id} p={p} />)}
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
