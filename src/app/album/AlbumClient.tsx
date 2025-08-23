// src/app/album/AlbumClient.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";

// 新しく作成したファイルをインポート
import { Quiz, useQuiz } from "./quiz";
import { SlideShow } from "./slideshow";
import { DateChips, PicturesGrid, endpoints, formatDate } from "./UI";
import { ImageModal } from "./ImageModal";

/* ───────────────────────────────────────────────────────────
   定数・ユーティリティ
   ─────────────────────────────────────────────────────────── */

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

  // SWR設定を取得（トップレベルで呼び出し）
  const { mutate } = useSWRConfig();

  // 認証チェック：未ログインなら /login へ（Hooks は常にトップレベルで宣言）
  const [me, setMe] = useState<{ account_id: number; email: string; role: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT || "http://localhost:8000"}/auth/me`, {
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
    authReady && selectedDate ? endpoints.byDate(selectedDate, tripId, 256) : null;
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
  
  // スライドショーを復元するための状態
  const [previousSlideshowDate, setPreviousSlideshowDate] = useState<string | null>(null);
  const [previousSlideshowPictures, setPreviousSlideshowPictures] = useState<PictureMeta[]>([]);

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

  // スライドショーを復元する関数
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

  // 画像モーダル関連の状態
  const [selectedPicture, setSelectedPicture] = useState<PictureMeta | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 写真をクリックしたときの処理
  const handlePictureClick = useCallback((picture: PictureMeta) => {
    setSelectedPicture(picture);
    setIsModalOpen(true);
  }, []);

  // モーダルを閉じる処理
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedPicture(null);
  }, []);

  // 写真削除の処理
  const handleDeletePictures = useCallback(async (pictureIds: number[]) => {
    if (!picsKey) return;

    const confirmMessage = pictureIds.length === 1 
      ? "この写真を削除しますか？（元に戻せません）"
      : `選択された${pictureIds.length}枚の写真を削除しますか？（元に戻せません）`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const deletePromises = pictureIds.map(async (id) => {
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

      await Promise.all(deletePromises);
      
      // SWRキャッシュを更新
      await mutate(
        picsKey,
        (prev: PictureMeta[] | undefined) => prev?.filter((x) => !pictureIds.includes(x.picture_id)),
        { revalidate: false }
      );

      // スライドショーの写真も更新
      if (slideshowPictures.length > 0) {
        setSlideshowPictures(prev => prev.filter(p => !pictureIds.includes(p.picture_id)));
      }

      alert(`${pictureIds.length}枚の写真を削除しました。`);
    } catch (error) {
      console.error('Delete error:', error);
      alert(`削除中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [picsKey, slideshowPictures.length, mutate]);

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
            
            {/* スライドショーに戻るボタン（スライドショーが閉じられている場合のみ表示） */}
            {!slideshowPictures.length && previousSlideshowDate && previousSlideshowPictures.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={restoreSlideshow}
                  className="text-white px-6 py-2 rounded-full font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: '#2B578A' }}
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
                  // スライドショーの状態を保存してから閉じる
                  setPreviousSlideshowDate(slideshowDate);
                  setPreviousSlideshowPictures([...slideshowPictures]);
                  // スライドショーで表示されている日付のアルバムを表示
                  setSelectedDate(slideshowDate);
                  setSlideshowPictures([]);
                  setSlideshowDate(null);
                  setIsPlaying(false);
                  setCurrentIndex(0);
                }}
              >
                {/* クイズコンポーネントを子要素として渡す */}
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
              onPictureClick={handlePictureClick}
              onDeletePictures={handleDeletePictures}
            />
          </section>
        </div>
      )}

      {/* 画像モーダル */}
      <ImageModal
        picture={selectedPicture}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </main>
  );
}


