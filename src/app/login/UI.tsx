// app/login/UI.tsx
"use client";

import React, { useState } from "react";

type LoginUIProps = {
  email: string;
  password: string;
  loading: "login" | "signup" | null;
  error: string | null;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onLogin: (e: React.FormEvent) => void;
  onSignup: () => void;
};

export default function LoginUI({
  email,
  password,
  loading,
  error,
  onEmailChange,
  onPasswordChange,
  onLogin,
  onSignup,
}: LoginUIProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#BDD9D7' }}>
      <div className="w-full max-w-md">
        {/* ロゴとタイトル */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: '#FCF98B' }}>
            {/* カメラアイコン */}
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#2B578A' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl mb-2" style={{ color: '#2B578A' }}>HONDAカメラ</h1>
          <p className="text-sm" style={{ color: '#2B578A' }}>思い出を記録する旅行写真アプリ</p>
        </div>

        {/* ログインフォーム */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-center text-xl mb-6" style={{ color: '#2B578A' }}>ログイン / 新規登録</h2>

          {/* フォーム */}
          <form onSubmit={onLogin}>
            <div className="space-y-4">
              {/* メールアドレス */}
              <div>
                <label htmlFor="email" className="block text-sm mb-2" style={{ color: '#2B578A' }}>
                  メールアドレス
                </label>
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  id="email"
                  placeholder="example@honda.com"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{
                    borderColor: '#2B578A',
                    '--tw-ring-color': '#2B578A'
                  } as React.CSSProperties}
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  required
                />
              </div>

              {/* パスワード */}
              <div>
                <label htmlFor="password" className="block text-sm mb-2" style={{ color: '#2B578A' }}>
                  パスワード
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    minLength={3}
                    autoComplete="current-password"
                    id="password"
                    className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50"
                    style={{
                      borderColor: '#2B578A',
                      '--tw-ring-color': '#2B578A'
                    } as React.CSSProperties}
                    value={password}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 hover:opacity-70"
                    style={{ color: '#2B578A' }}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* エラー表示 */}
              {error && (
                <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                  {error}
                </div>
              )}

              {/* ログインボタン */}
              <button
                type="submit"
                disabled={loading !== null}
                className="w-full text-white py-3 px-4 rounded-lg transition-colors"
                style={{
                  backgroundColor: loading === "login" ? '#9CA3AF' : '#2B578A',
                  opacity: loading !== null ? 0.7 : 1
                }}
              >
                {loading === "login" ? "ログイン中…" : "ログイン"}
              </button>

              {/* 新規登録ボタン */}
              <button
                type="button"
                disabled={loading !== null}
                onClick={onSignup}
                className="w-full text-white py-3 px-4 rounded-lg transition-colors"
                style={{
                  backgroundColor: loading === "signup" ? '#9CA3AF' : '#2B578A',
                  opacity: loading !== null ? 0.7 : 1
                }}
              >
                {loading === "signup" ? "作成中…" : "新規ID登録"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
