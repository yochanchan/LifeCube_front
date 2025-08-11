// app/auth/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

/** APIベースURL（末尾の / を除去） */
const API_BASE_RAW = process.env.NEXT_PUBLIC_API_ENDPOINT;
const API_BASE = (API_BASE_RAW ?? "").replace(/\/+$/, "");

/** JSONを安全に読む小ヘルパ（失敗時は null） */
async function readJson<T>(res: Response): Promise<T | null> {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return (await res.json()) as T;
  } catch { }
  return null;
}

export default function AuthPage() {
  const router = useRouter();

  // 入力状態
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // 進行状態とエラー
  const [loading, setLoading] = useState<"login" | "signup" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // 共通送信ハンドラ（action は 'login' or 'signup'）
  const submit = async (action: "login" | "signup") => {
    setErr(null);
    setLoading(action);
    try {
      const res = await fetch(`${API_BASE}/auth/${action}`, {
        method: "POST",
        credentials: "include", // ← Cookie を受け取る/送るのに必須
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (!res.ok) {
        const j = await readJson<{ detail?: string }>(res);
        const msg =
          j?.detail ||
          (res.status === 401
            ? "メールまたはパスワードが違います"
            : res.status === 409
              ? "このメールは既に登録されています"
              : `失敗しました (${res.status})`);
        throw new Error(msg);
      }

      // 成功 → /album へ
      router.push("/album");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(null);
    }
  };

  // Enter キーで「ログイン」実行（好みで変更可）
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loading) submit("login");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-rose-50 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white/90 p-6 shadow ring-1 ring-rose-100"
      >
        <h1 className="text-center text-2xl font-extrabold text-rose-800">ログイン / 新規登録</h1>

        {/* 入力2行（メール、パスワード） */}
        <div className="mt-6 space-y-3">
          <input
            type="text" // PoC用になんでも通す
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-xl border border-rose-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-300"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            minLength={3} // PoC用に3文字でok
            autoComplete="current-password"
            placeholder="パスワード"
            className="w-full rounded-xl border border-rose-200 px-3 py-2 outline-none focus:ring-2 focus:ring-rose-300"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* エラー表示 */}
        {err && (
          <p className="mt-3 rounded-xl bg-rose-50 p-2 text-sm text-rose-700">{err}</p>
        )}

        {/* ボタン横2列（ログイン / 新規作成） */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="submit"
            disabled={loading !== null}
            className="rounded-xl bg-rose-500 px-4 py-2 font-semibold text-white shadow hover:bg-rose-600 disabled:opacity-50"
            title="ログイン"
          >
            {loading === "login" ? "ログイン中…" : "ログイン"}
          </button>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => submit("signup")}
            className="rounded-xl bg-rose-100 px-4 py-2 font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
            title="新規ID登録"
          >
            {loading === "signup" ? "作成中…" : "新規ID登録"}
          </button>
        </div>
      </form>
    </main>
  );
}
