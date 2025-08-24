// src/app/album/AlbumClient.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
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

  const startQuiz = useCallback(async () => {
    if (slideshowPictures.length > 0 && currentIndex < slideshowPictures.length) {
      const currentPicture = slideshowPictures[currentIndex];
      
      // 現在の写真から場所とコメントの情報を取得（ローカルストレージからも取得）
      const key = `picture_${currentPicture.picture_id}`;
      const savedData = localStorage.getItem(key);
      let locationName = currentPicture.location_name;
      let userComment = currentPicture.user_comment;
      
      if (savedData) {
        try {
          const savedPicture = JSON.parse(savedData);
          locationName = savedPicture.location_name || currentPicture.location_name;
          userComment = savedPicture.user_comment || currentPicture.user_comment;
        } catch (error) {
          console.error('Failed to parse saved data:', error);
        }
      }
      
      // 現在の写真に場所の情報がない場合は、同じ日の全写真から場所の情報を探す
      if (!locationName) {
        // 同じ日の全写真から場所の情報を探す（スライドショーに表示されていない写真も含む）
        let allSameDayPictures: PictureMeta[] = [];
        
        // スライドショーに表示されている写真から場所の情報を探す
        const slideshowPicturesWithLocation = slideshowPictures.filter(picture => {
          if (picture.picture_id === currentPicture.picture_id) return false; // 現在の写真は除外
          
          // ローカルストレージからも情報を取得
          const pictureKey = `picture_${picture.picture_id}`;
          const pictureSavedData = localStorage.getItem(pictureKey);
          let pictureLocation = picture.location_name;
          
          if (pictureSavedData) {
            try {
              const savedPicture = JSON.parse(pictureSavedData);
              pictureLocation = savedPicture.location_name || picture.location_name;
            } catch (error) {
              console.error('Failed to parse saved data:', error);
            }
          }
          
          return pictureLocation; // 場所の情報のみを返す
        });
        
        allSameDayPictures.push(...slideshowPicturesWithLocation);
        
        // 同じ日の全写真から場所の情報を探す（APIから取得）
        if (slideshowDate && authReady) {
          try {
            // 同じ日の全写真を取得
            const allPicturesKey = endpoints.byDate(slideshowDate, tripId, 800);
            const allPictures = await apiclient.getJSON<PictureMeta[]>(allPicturesKey);
            
            if (allPictures && allPictures.length > 0) {
              // スライドショーに表示されていない写真から場所の情報を探す
              const additionalPictures = allPictures.filter(picture => {
                // スライドショーに表示されている写真は除外
                const isInSlideshow = slideshowPictures.some(slideshowPic => 
                  slideshowPic.picture_id === picture.picture_id
                );
                if (isInSlideshow) return false;
                
                // ローカルストレージからも情報を取得
                const pictureKey = `picture_${picture.picture_id}`;
                const pictureSavedData = localStorage.getItem(pictureKey);
                let pictureLocation = picture.location_name;
                
                if (pictureSavedData) {
                  try {
                    const savedPicture = JSON.parse(pictureSavedData);
                    pictureLocation = savedPicture.location_name || picture.location_name;
                  } catch (error) {
                    console.error('Failed to parse saved data:', error);
                  }
                }
                
                return pictureLocation; // 場所の情報のみを返す
              });
              
              allSameDayPictures.push(...additionalPictures);
            }
          } catch (error) {
            console.error('Failed to fetch all pictures for the same date:', error);
          }
        }
        
        if (allSameDayPictures.length > 0) {
          // ランダムで1枚選択
          const randomPicture = allSameDayPictures[Math.floor(Math.random() * allSameDayPictures.length)];
          const randomKey = `picture_${randomPicture.picture_id}`;
          const randomSavedData = localStorage.getItem(randomKey);
          
          if (randomSavedData) {
            try {
              const savedRandomPicture = JSON.parse(randomSavedData);
              locationName = savedRandomPicture.location_name || randomPicture.location_name;
            } catch (error) {
              console.error('Failed to parse saved data:', error);
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
        
        // 場所に関する選択肢を生成（地名のみ）
        const locationChoices = [
          "東京", "大阪", "京都", "名古屋", "横浜", "神戸", "札幌", "仙台", "福岡", "広島",
          "奈良", "鎌倉", "箱根", "富士山", "沖縄", "北海道", "九州", "四国", "東北", "関西",
          "伊豆", "熱海", "軽井沢", "白浜", "由布院", "草津", "有馬", "登別", "下呂", "別府"
        ];
        
        // 正解の場所が選択肢に含まれていない場合は追加
        if (!locationChoices.includes(answer)) {
          locationChoices.push(answer);
        }
        
        // 4つの選択肢をランダムで選択
        const choices = [answer];
        const otherChoices = locationChoices.filter(choice => choice !== answer);
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
        // 場所の情報が記入されていない場合のメッセージ
        alert("この日の写真には場所の情報が不足しています。\n写真を編集して場所を追加してからクイズを開始してください。");
      }
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

  const handleLogout = useCallback(async () => {
    try {
      // ローカルストレージのJWTトークンを削除
      localStorage.removeItem('jwt_token');
      // ログインページにリダイレクト
      router.replace('/login');
    } catch (error) {
      console.error('ログアウトエラー:', error);
      // エラーが発生してもログインページにリダイレクト
      router.replace('/login');
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

          {/* ナビゲーションボタン */}
          <section className="mt-6">
            <div className="grid grid-cols-4 gap-3">
              {/* 車外カメラボタン */}
        <button
                onClick={() => router.push('/shooter')}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
                aria-label="車外カメラページに移動"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#5BD3CB' }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
      </div>
                  <span className="text-xs" style={{ color: '#2B578A' }}>車外カメラ</span>
          </div>
                </button>

              {/* 車内操作ボタン */}
              <button
                onClick={() => router.push('/recorder')}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
                aria-label="車内操作ページに移動"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#B6A98B' }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
            </div>
                  <span className="text-xs" style={{ color: '#2B578A' }}>車内操作</span>
            </div>
              </button>

              {/* トップに戻るボタン */}
              <button
                onClick={() => router.push('/room')}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
                aria-label="トップページに戻る"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2B578A' }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </div>
                  <span className="text-xs" style={{ color: '#2B578A' }}>トップに戻る</span>
                </div>
              </button>

              {/* ログアウトボタン */}
              <button
                onClick={handleLogout}
                className="w-full rounded-xl bg-white p-3 hover:shadow-lg transition-shadow cursor-pointer ring-1 ring-blue-200"
                aria-label="ログアウト"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#7B818B' }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <span className="text-xs" style={{ color: '#2B578A' }}>ログアウト</span>
                </div>
              </button>
            </div>
          </section>
              </div>
            )}

      {/* 画像モーダル */}
      <ImageModal picture={selectedPicture} isOpen={isModalOpen} onClose={handleCloseModal} />
    </main>
  );
}
