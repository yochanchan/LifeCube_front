// src/app/album/quiz.tsx
"use client";

import React, { useState, useCallback } from "react";
import type { PictureMeta } from "./types";

export interface QuizProps {
  showQuiz: boolean;
  quizQuestion: string;
  quizAnswer: string;
  quizChoices: string[];
  userAnswer: string;
  quizResult: "correct" | "incorrect" | null;
  onUserAnswerChange: (answer: string) => void;
  onSubmitQuiz: () => void;
  onCloseQuiz: () => void;
}

export function Quiz({
  showQuiz,
  quizQuestion,
  quizAnswer,
  quizChoices,
  userAnswer,
  quizResult,
  onUserAnswerChange,
  onSubmitQuiz,
  onCloseQuiz,
}: QuizProps) {
  if (!showQuiz) return null;

  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-xl font-zen-maru-gothic">
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
              style={{
                borderColor: "#2B578A",
                "--tw-ring-color": "#2B578A",
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
  );
}

export function useQuiz() {
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState<string>("");
  const [quizAnswer, setQuizAnswer] = useState<string>("");
  const [quizChoices, setQuizChoices] = useState<string[]>([]);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [quizResult, setQuizResult] = useState<"correct" | "incorrect" | null>(null);

  // クイズを自動生成して開始
  const startQuiz = useCallback((currentPicture: PictureMeta) => {
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
      let timeOfDay = "";
      if (hours >= 5 && hours < 12) timeOfDay = "朝";
      else if (hours >= 12 && hours < 17) timeOfDay = "昼";
      else if (hours >= 17 && hours < 21) timeOfDay = "夕方";
      else timeOfDay = "夜";

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
  }, []);

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

  return {
    showQuiz,
    quizQuestion,
    quizAnswer,
    quizChoices,
    userAnswer,
    quizResult,
    setUserAnswer,
    startQuiz,
    submitQuiz,
    closeQuiz,
  };
}
