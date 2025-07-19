"use client";
import { useState, FormEvent, ChangeEvent } from "react";

/* ------------------------------------------------------------------ */
/* 型定義                                                              */
/* ------------------------------------------------------------------ */
type Seat = "DRIVER" | "FRONT_PASSENGER" | "REAR_LEFT" | "REAR_RIGHT";

type PassengerForm = {
  seat: Seat;
  vacant: boolean;
  name: string;
  age: number;
  gender: string;
  likes_pretend_play: boolean;
  role: string;
};

/* 座席の日本語ラベル */
const seatJP: Record<Seat, string> = {
  DRIVER: "運転席",
  FRONT_PASSENGER: "助手席",
  REAR_LEFT: "後部左",
  REAR_RIGHT: "後部右",
};

export default function RideForm() {
  /* ---------------- 入力ステート ---------------- */
  const [scenario, setScenario] = useState("アナと雪の女王");
  const [destination, setDestination] = useState("親戚の家");
  const [rideTime, setRideTime] = useState(30);
  const [passengers, setPassengers] = useState<PassengerForm[]>([
    {
      seat: "DRIVER",
      vacant: false,
      name: "パパ",
      age: 34,
      gender: "男性",
      likes_pretend_play: false,
      role: "クリストフ",
    },
    {
      seat: "FRONT_PASSENGER",
      vacant: false,
      name: "ママ",
      age: 34,
      gender: "女性",
      likes_pretend_play: false,
      role: "オラフ",
    },
    {
      seat: "REAR_LEFT",
      vacant: false,
      name: "きなちゃん",
      age: 5,
      gender: "女性",
      likes_pretend_play: true,
      role: "アナ",
    },
    {
      seat: "REAR_RIGHT",
      vacant: false,
      name: "なこちゃん",
      age: 2,
      gender: "女性",
      likes_pretend_play: true,
      role: "エルサ",
    },
  ]);

  /* ---------------- UI 状態 ---------------- */
  const [loading, setLoading] = useState(false);            // /play 送信中
  const [narration, setNarration] = useState<string | null>(null); // 生成結果の原文
  const [editableText, setEditableText] = useState<string>("");    // 編集可能なテキスト
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);            // /tts 送信中

  /* ---------------- ユーティリティ ---------------- */
  const updatePassenger = <K extends keyof PassengerForm>(
    idx: number,
    key: K,
    value: PassengerForm[K]
  ) => {
    setPassengers((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p))
    );
  };

  const toggleVacant = (idx: number, vacant: boolean) => {
    setPassengers((prev) =>
      prev.map((p, i) =>
        i === idx
          ? vacant
            ? {
              ...p,
              vacant: true,
              name: "",
              age: 0,
              gender: "",
              likes_pretend_play: false,
              role: "",
            }
            : { ...p, vacant: false }
          : p
      )
    );
  };

  /* ---------------- /play Submit ---------------- */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNarration(null);
    setEditableText("");
    setAudioUrl(null);

    const activePassengers = passengers
      .filter((p) => !p.vacant)
      .map(({ seat, name, age, gender, likes_pretend_play, role }) => ({
        seat,
        name,
        age,
        gender,
        likes_pretend_play,
        role,
      }));

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_ENDPOINT + "/openai/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario,
          destination,
          ride_time: rideTime,
          passengers: activePassengers,
        }),
      });

      if (!res.ok) throw new Error("生成失敗");

      const data = await res.json();
      const generated = data.narration ?? "ナレーションが取得できませんでした";
      setNarration(generated);
      /* setEditableText(generated); // テキストエリアに反映=させない */
    } catch (err) {
      console.error(err);
      alert("送信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- /tts 呼び出し ---------------- */
  const handleTTS = async () => {
    if (!editableText.trim() || ttsBusy) return;
    setTtsBusy(true);
    setAudioUrl(null);

    /* TTS-1 は 4,096 文字上限 */
    const safeText = editableText.slice(0, 4096);

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_ENDPOINT + "/openai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partial_narration: safeText }),
      });

      if (!res.ok) throw new Error("TTS 失敗");

      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      alert("音声生成に失敗しました");
    } finally {
      setTtsBusy(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">情報入力</h1>

      {/* フォーム本体 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* シナリオ */}
        <label className="block">
          <span className="text-sm">シナリオ</span>
          <input
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="input input-bordered w-full"
          />
        </label>

        {/* 目的地 */}
        <label className="block">
          <span className="text-sm">目的地</span>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="input input-bordered w-full"
          />
        </label>

        {/* 乗車時間 */}
        <label className="block">
          <span className="text-sm">乗車時間（分）</span>
          <input
            type="number"
            min={1}
            value={rideTime}
            onChange={(e) => setRideTime(Number(e.target.value))}
            className="input input-bordered w-full"
          />
        </label>

        {/* 乗員入力 */}
        <div className="rounded border p-4 space-y-6">
          <h2 className="font-semibold mb-2">キャスト</h2>

          {passengers.map((p, idx) => (
            <div
              key={p.seat}
              className={`p-3 rounded border ${p.vacant ? "opacity-50 bg-gray-100" : ""
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{seatJP[p.seat]}</span>

                <label className="inline-flex items-center text-sm gap-1">
                  <input
                    type="checkbox"
                    checked={p.vacant}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      toggleVacant(idx, e.target.checked)
                    }
                  />
                  空席にする
                </label>
              </div>

              {/* 呼び名 */}
              <label className="block text-sm mb-1">
                呼び名
                <input
                  disabled={p.vacant}
                  value={p.name}
                  onChange={(e) => updatePassenger(idx, "name", e.target.value)}
                  className="input input-bordered w-full mt-1"
                />
              </label>

              {/* 年齢 */}
              <label className="block text-sm mb-1">
                年齢
                <input
                  disabled={p.vacant}
                  type="number"
                  min={0}
                  value={p.age}
                  onChange={(e) =>
                    updatePassenger(idx, "age", Number(e.target.value))
                  }
                  className="input input-bordered w-full mt-1"
                />
              </label>

              {/* 配役 */}
              <label className="block text-sm mb-1">
                配役
                <input
                  disabled={p.vacant}
                  value={p.role}
                  onChange={(e) => updatePassenger(idx, "role", e.target.value)}
                  className="input input-bordered w-full mt-1"
                />
              </label>

              {/* ごっこ好き */}
              <label className="inline-flex items-center gap-2 mt-2">
                <input
                  disabled={p.vacant}
                  type="checkbox"
                  checked={p.likes_pretend_play}
                  onChange={(e) =>
                    updatePassenger(
                      idx,
                      "likes_pretend_play",
                      e.target.checked
                    )
                  }
                />
                ごっこ遊びが好き
              </label>
            </div>
          ))}
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={loading}
        >
          {loading ? "送信中..." : "送信"}
        </button>
      </form>

      {/* ローディング表示 */}
      {loading && (
        <p className="mt-4 text-center text-blue-600 animate-pulse">
          ナレーションを生成中です。しばらくお待ちください…
        </p>
      )}

      {/* ナレーション & 編集エリア & TTS */}
      {narration && !loading && (
        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold">生成されたナレーション</h2>
          <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded">
            {narration}
          </pre>

          {/* 編集用テキストエリア */}
          <label className="block">
            <span className="text-sm font-medium">読み上げ用テキスト（編集可）</span>
            <textarea
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              rows={6}
              className="textarea textarea-bordered w-full mt-1"
            />
          </label>

          <button
            className="btn btn-outline"
            onClick={handleTTS}
            disabled={ttsBusy || !editableText.trim()}
          >
            {ttsBusy ? "音声生成中…" : "音声生成"}
          </button>

          {audioUrl && <audio src={audioUrl} controls className="w-full mt-2" />}
        </section>
      )}
    </main>
  );
}
