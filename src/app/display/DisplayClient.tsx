"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ImageGallery from "./ImageGallery";

type Me = { account_id: number; email: string; role: string };

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");

export default function DisplayClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 認証チェック
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error("not authenticated");
        const j = (await res.json()) as Me;
        if (!cancelled) {
          setMe(j);
        }
      } catch {
        if (!cancelled) {
          router.replace(`/login?next=/display`);
        }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50">
        <div className="mx-auto max-w-5xl p-4">
          <div className="rounded-xl bg-white/80 p-4 ring-1 ring-rose-100 text-rose-700">
            認証中...
          </div>
        </div>
      </main>
    );
  }

  if (!me) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-orange-100">
      <div className="mx-auto max-w-7xl p-4">
        {/* ヘッダー */}
        <header className="mb-6 rounded-2xl bg-white/70 p-6 shadow-sm ring-1 ring-orange-100">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-3xl font-bold text-orange-800">最新画像表示</h1>
            <span className="ml-auto rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700">
              account_id: <strong>{me.account_id}</strong>
            </span>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700">
              {me.email}
            </span>
          </div>
          <p className="mt-2 text-orange-600">
            Recorderページで撮影された最新の画像を表示します
          </p>
        </header>

        {/* 最新画像ギャラリー */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
          <ImageGallery
            apiBase={API_BASE}
            accountId={me.account_id}
          />
        </section>
      </div>
    </main>
  );
}
