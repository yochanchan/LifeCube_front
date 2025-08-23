// src/app/album/AlbumClient.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Quiz } from "./quiz";
import { SlideShow } from "./slideshow";
import { DateChips, PicturesGrid, endpoints } from "./UI";
import { ImageModal } from "./ImageModal";
import { apiclient } from "@/lib/apiclient";

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
  thumbnail_path?: string; // 例: /api/pictures/{id}/thumbnail?w=256 （パスのみ）
};

/* ───────────────────────────────────────────────────────────
   SWR fetcher（JWT対応：apiclient経由）
   ─────────────────────────────────────────────────────────── */
const fetcher = <T,>(path: string) => apiclient.getJSON<T>(path);

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
  const { mutate } = useSWRConfig();

  // 認証チェック（JWT：apiclient経由）
  const [me, setMe] = useState<{ account_id: number; email: string; role: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const j = await apiclient.getJSON<{ account_id: number; email: string; role: string }>("/auth/me");
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
  const picsKey = authReady && selectedDate ? endpoints.byDate(selectedDate, tripId, 256) : null;
  const {
    data: pictures = initial.pictures,
    error: errorPics,
    isLoading: loadingPics,
  } = useSWR<PictureMeta[] | undefined>(picsKey, fetcher, { fallbackData: initial.pictures });

  // スライドショー関連の状態
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlayInterval, setAutoPlayInterval] = useState<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  // スライドショー用のランダム日付と写真
  const [slideshowDate, setSlideshowDate] = useState<string | null>(null);
  const [slideshowPictures, setSlideshowPictures] = useState<PictureMeta[]>([]);

  // スライドショー復元用
  const [previousSlideshowDate, setPreviousSlideshowDate] = useState<string | null>(null);
  const [previousSlideshowPictures, setPreviousSlideshowPictures] = useState<PictureMeta[]>([]);

  // 利用可能な日付からランダムで1つ選択
  useEffect(() => {
    if (dates && dates.length > 0) {
      const randomDate = dates[Math.floor(Math.random() * dates.length)];
      setSlideshowDate(randomDate);
    }
  }, [dates]);

  // 選択された日付の写真（スライドショー用）
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
      }, 3000);
      setAutoPlayInterval(interval);
      return () => clearInterval(interval);
    } else if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      setAutoPlayInterval(null);
    }
  }, [isPlaying, slideshowPictures.length]);

  // アンマウント時にクリーンアップ
  useEffect(() => {
    return () => {
      if (autoPlayInterval) clearInterval(autoPlayInterval);
    };
  }, [autoPlayInterval]);

  // スライドショーコントロール
  const togglePlayPause = useCallback(() => setIsPlaying((v) => !v), []);

  // スライドショー復元
  const restoreSlideshow = useCallback(() => {
    if (previousSlideshowDate && previousSlideshowPictures.length > 0) {
      setSlideshowDate(previousSlideshowDate);
      setSlideshowPictures(previousSlideshowPictures);
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  }, [previousSlideshowDate, previousSlideshowPictures]);

  // クイズ関連の状態
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
        const timeOfDay = hours >= 5 && hours < 12 ? "朝" : hours < 17 ? "昼" : hours < 21 ? "夕方" : "夜";
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

  // 画像モーダル
  const [selectedPicture, setSelectedPicture] = useState<PictureMeta | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handlePictureClick = useCallback((picture: PictureMeta) => {
    setSelectedPicture(picture);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedPicture(null);
  }, []);

  // 写真削除（JWT対応）
  const handleDeletePictures = useCallback(
    async (pictureIds: number[]) => {
      if (!picsKey) return;

      const confirmMessage =
        pictureIds.length === 1
          ? "この写真を削除しますか？（元に戻せません）"
          : `選択された${pictureIds.length}枚の写真を削除しますか？（元に戻せません）`;

      if (!window.confirm(confirmMessage)) return;

      try {
        await Promise.all(pictureIds.map((id) => apiclient.del(endpoints.deletePicture(id))));
        // SWRキャッシュを更新
        await mutate(
          picsKey,
          (prev: PictureMeta[] | undefined) => prev?.filter((x) => !pictureIds.includes(x.picture_id)),
          { revalidate: false }
        );
        // スライドショーの写真も更新
        if (slideshowPictures.length > 0) {
          setSlideshowPictures((prev) => prev.filter((p) => !pictureIds.includes(p.picture_id)));
        }
        alert(`${pictureIds.length}枚の写真を削除しました。`);
      } catch (error) {
        console.error("Delete error:", error);
        alert(`削除中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [picsKey, slideshowPictures.length, mutate]
  );

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

            {/* スライドショーに戻るボタン */}
            {!slideshowPictures.length && previousSlideshowDate && previousSlideshowPictures.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={restoreSlideshow}
                  className="text-white px-6 py-2 rounded-full font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: "#2B578A" }}
                  aria-label="スライドショーに戻る"
                >
                  過去の思い出に戻る
                </button>
              </div>
            )}
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
                onGoToAlbum={() => {
                  setPreviousSlideshowDate(slideshowDate);
                  setPreviousSlideshowPictures([...slideshowPictures]);
                  setSelectedDate(slideshowDate);
                  setSlideshowPictures([]);
                  setSlideshowDate(null);
                  setIsPlaying(false);
                  setCurrentIndex(0);
                }}
              >
                <Quiz
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
              </SlideShow>
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

          {/* 写真グリッド */}
          <section className="mb-8">
            <h2 className="sr-only">写真一覧</h2>
            <PicturesGrid
              items={pictures ?? []}
              loading={!!loadingPics}
              error={errorPics ? (errorPics as Error).message : null}
              swrKey={picsKey}
              onPictureClick={handlePictureClick}
              onDeletePictures={handleDeletePictures}
            />
          </section>
        </div>
      )}

      {/* 画像モーダル */}
      <ImageModal picture={selectedPicture} isOpen={isModalOpen} onClose={handleCloseModal} />
    </main>
  );
}
