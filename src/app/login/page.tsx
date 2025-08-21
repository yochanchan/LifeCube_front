// app/login/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import LoginUI from "./UI";

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

      // 成功 → roomページ へ
      router.push("/room");
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

  const handleSignup = () => {
    if (!loading) submit("signup");
  };

  return (
    <LoginUI
      email={email}
      password={password}
      loading={loading}
      error={err}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onLogin={onSubmit}
      onSignup={handleSignup}
    />
  );
}
