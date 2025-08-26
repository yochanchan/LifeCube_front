// src/app/album/AlbumClient.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { Quiz } from "./quiz";
import { SlideShow } from "./slideshow";
import { DateChips, PicturesGrid, endpoints, PictureMeta } from "./UI";
import { ImageModal } from "./ImageModal";
import { apiclient } from "@/lib/apiclient";

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
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      setCurrentIndex(0);
    }
  }, [allSlideshowPictures]);

  // スライドショーの自動再生/停止（refで一元管理）
  useEffect(() => {
    // 既存停止
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
    if (isPlaying && slideshowPictures.length > 0) {
      autoplayRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % slideshowPictures.length);
      }, 3000);
    }
    return () => {
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current);
        autoplayRef.current = null;
      }
    };
  }, [isPlaying, slideshowPictures.length]);

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

  const startQuiz = useCallback(async () => {
    if (slideshowPictures.length === 0 || currentIndex >= slideshowPictures.length) return;

    const currentPicture = slideshowPictures[currentIndex];

    // 現在の写真から場所とコメントの情報を取得（ローカルストレージも参照）
    const key = `picture_${currentPicture.picture_id}`;
    const savedData = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    let locationName = currentPicture.location_name;
    let userComment = currentPicture.user_comment;

    if (savedData) {
      try {
        const savedPicture = JSON.parse(savedData);
        locationName = savedPicture.location_name || currentPicture.location_name;
        userComment = savedPicture.user_comment || currentPicture.user_comment;
      } catch (error) {
        console.error("Failed to parse saved data:", error);
      }
    }

    // 現在の写真に場所がない場合、同日の他の写真から補完（スライドショー＋API）
    if (!locationName) {
      let allSameDayPictures: PictureMeta[] = [];

      // スライドショー中の他写真から探索
      const slideshowPicturesWithLocation = slideshowPictures.filter((picture) => {
        if (picture.picture_id === currentPicture.picture_id) return false;
        const pictureKey = `picture_${picture.picture_id}`;
        const pictureSavedData = typeof window !== "undefined" ? localStorage.getItem(pictureKey) : null;
        let pictureLocation = picture.location_name;
        if (pictureSavedData) {
          try {
            const savedPicture = JSON.parse(pictureSavedData);
            pictureLocation = savedPicture.location_name || picture.location_name;
          } catch (error) {
            console.error("Failed to parse saved data:", error);
          }
        }
        return !!pictureLocation;
      });
      allSameDayPictures.push(...slideshowPicturesWithLocation);

      // APIから同日の全写真を取得して不足を補完
      if (slideshowDate && authReady) {
        try {
          const allPicturesKey = endpoints.byDate(slideshowDate, tripId, 800);
          const allPictures = await apiclient.getJSON<PictureMeta[]>(allPicturesKey);
          if (allPictures && allPictures.length > 0) {
            const additionalPictures = allPictures.filter((picture) => {
              const isInSlideshow = slideshowPictures.some((p) => p.picture_id === picture.picture_id);
              if (isInSlideshow) return false;

              const pictureKey = `picture_${picture.picture_id}`;
              const pictureSavedData = typeof window !== "undefined" ? localStorage.getItem(pictureKey) : null;
              let pictureLocation = picture.location_name;
              if (pictureSavedData) {
                try {
                  const savedPicture = JSON.parse(pictureSavedData);
                  pictureLocation = savedPicture.location_name || picture.location_name;
                } catch (error) {
                  console.error("Failed to parse saved data:", error);
                }
              }
              return !!pictureLocation;
            });
            allSameDayPictures.push(...additionalPictures);
          }
        } catch (error) {
          console.error("Failed to fetch all pictures for the same date:", error);
        }
      }

      if (allSameDayPictures.length > 0) {
        const randomPicture = allSameDayPictures[Math.floor(Math.random() * allSameDayPictures.length)];
        const randomKey = `picture_${randomPicture.picture_id}`;
        const randomSavedData = typeof window !== "undefined" ? localStorage.getItem(randomKey) : null;

        if (randomSavedData) {
          try {
            const savedRandomPicture = JSON.parse(randomSavedData);
            locationName = savedRandomPicture.location_name || randomPicture.location_name;
          } catch (error) {
            console.error("Failed to parse saved data:", error);
          }
        } else {
          locationName = randomPicture.location_name;
        }
      }
    }

    // 場所の情報がある場合のみクイズを生成
    if (locationName) {
      const question = `どこに行ったでしょう？`;
      const answer = locationName;

      // ダミー候補 + 正解
      const locationChoices = [
        "東京", "大阪", "京都", "名古屋", "横浜", "神戸", "札幌", "仙台", "福岡", "広島",
        "奈良", "鎌倉", "箱根", "富士山", "沖縄", "北海道", "九州", "四国", "東北", "関西",
        "伊豆", "熱海", "軽井沢", "白浜", "由布院", "草津", "有馬", "登別", "下呂", "別府",
      ];
      if (!locationChoices.includes(answer)) locationChoices.push(answer);

      const choices = [answer];
      const otherChoices = locationChoices.filter((c) => c !== answer);
      const shuffledOthers = otherChoices.sort(() => Math.random() - 0.5);
      choices.push(...shuffledOthers.slice(0, 3));
      const shuffledChoices = [...choices].sort(() => Math.random() - 0.5);

      setQuizQuestion(question);
      setQuizAnswer(answer);
      setQuizChoices(shuffledChoices);
      setUserAnswer("");
      setQuizResult(null);
      setShowQuiz(true);
    } else {
      alert("この日の写真には場所の情報が不足しています。\n写真を編集して場所を追加してからクイズを開始してください。");
    }
  }, [slideshowPictures, currentIndex, slideshowDate, authReady, tripId]);

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

  const handleLogout = useCallback(async () => {
    try {
      localStorage.removeItem("jwt_token");
      router.replace("/login");
    } catch (error) {
      console.error("ログアウトエラー:", error);
      router.replace("/login");
    }
  }, [router]);

  return (
    <main className="min-h-screen font-zen-maru-gothic" style={{ backgroundColor: "#BDD9D7" }}>
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
            <div className="flex items-center justify-center gap-3 mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#2B578A" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h1 className="text-xl" style={{ color: "#2B578A" }}>アルバム</h1>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#2B578A" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>

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
            <h2 className="text-lg mb-4" style={{ color: "#2B578A" }}>アルバム日付</h2>
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

          {/* ナビゲーションボタン */}
          <section className="mt-6">
            <div className="grid grid-cols-4 gap-3">
              {/* 車外カメラ */}
              <button
                onClick={() => router.push("/shooter")}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
                aria-label="車外カメラページに移動"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#5BD3CB" }}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-[10px]" style={{ color: "#2B578A" }}>車外カメラ</span>
                </div>
              </button>

              {/* 車内操作 */}
              <button
                onClick={() => router.push("/recorder")}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
                aria-label="車内操作ページに移動"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#B6A98B" }}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5a6.5 6.5 0 006.5-6.5v-4a6.5 6.5 0 00-13 0v4a6.5 6.5 0 006.5 6.5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.5v3" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 22h8" />
                    </svg>
                  </div>
                  <span className="text-[10px]" style={{ color: "#2B578A" }}>車内操作</span>
                </div>
              </button>

              {/* トップに戻る */}
              <button
                onClick={() => router.push("/room")}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
                aria-label="トップページに戻る"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#2B578A" }}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </div>
                  <span className="text-[10px]" style={{ color: "#2B578A" }}>トップに戻る</span>
                </div>
              </button>

              {/* ログアウト */}
              <button
                onClick={handleLogout}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
                aria-label="ログアウト"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#7B818B" }}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <span className="text-[10px]" style={{ color: "#2B578A" }}>ログアウト</span>
                </div>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 画像モーダル（常駐） */}
      <ImageModal picture={selectedPicture} isOpen={isModalOpen} onClose={handleCloseModal} />
    </main>
  );
}
