// src/app/room/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");

type Me = { account_id: number; email: string; role: string };
type Roster = { recorder: string | null; shooters: string[]; counts: { recorder: number; shooter: number } };

function getOrCreateDeviceId(): string {
  try {
    const KEY = "device_uid";
    let id = localStorage.getItem(KEY);
    if (!id) {
      // 古いiOS対策: randomUUIDが無い場合のフォールバック
      const rnd = (globalThis.crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      id = rnd;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

// 絶対URLを安全生成
function buildUrl(path: string) {
  const base = API_BASE || (typeof window !== "undefined" ? window.location.origin : "");
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

export default function RoomSelectPage() {
  const router = useRouter();

  // 状態: me の取得結果を明確に分離
  const [me, setMe] = useState<Me | null>(null);
  const [meStatus, setMeStatus] = useState<"idle" | "loading" | "ok" | "unauth" | "error">("idle");
  const [meError, setMeError] = useState<string>("");

  const [roster, setRoster] = useState<Roster | null>(null);
  const [rosterError, setRosterError] = useState<string>("");

  const didRedirectRef = useRef(false);

  const myDeviceId = useMemo(getOrCreateDeviceId, []);
  const room = me ? `acc:${me.account_id}` : null;

  const fetchMe = useCallback(async (signal: AbortSignal) => {
    setMeStatus("loading");
    setMeError("");
    try {
      const res = await fetch(buildUrl("/auth/me"), {
        credentials: "include",
        cache: "no-store",
        signal,
        headers: { Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) {
        setMeStatus("unauth");
        return;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const j = (await res.json()) as Me;
      setMe(j);
      setMeStatus("ok");
    } catch (e: any) {
      if (signal.aborted) return; // 遷移/タイムアウト等
      setMeError(e?.message ?? "network error");
      setMeStatus("error");
    }
  }, []);

  // 認証確認（10秒タイムアウト＋確実な中断）
  useEffect(() => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10_000);
    fetchMe(ctrl.signal);
    return () => {
      clearTimeout(to);
      ctrl.abort();
    };
  }, [fetchMe]);

  // 未認証のときだけ一度だけ /login に置換
  useEffect(() => {
    if (meStatus === "unauth" && !didRedirectRef.current) {
      didRedirectRef.current = true;
      router.replace(`/login?next=/room`);
    }
  }, [meStatus, router]);

  // 参加者情報の取得（okのときだけ、8秒で中断）
  useEffect(() => {
    if (meStatus !== "ok" || !room) return;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8_000);

    (async () => {
      try {
        const url = new URL("/ws/roster", API_BASE || window.location.origin);
        url.searchParams.set("room", room);
        const res = await fetch(url.toString(), {
          credentials: "include",
          cache: "no-store",
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const j = (await res.json()) as Roster;
        setRoster(j);
        setRosterError("");
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        setRosterError(e?.message ?? "network error");
      } finally {
        clearTimeout(to);
      }
    })();

    return () => {
      clearTimeout(to);
      ctrl.abort();
    };
  }, [meStatus, room]);

  const retryAuth = () => {
    const ctrl = new AbortController();
    fetchMe(ctrl.signal);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50 p-4">
      {meStatus === "loading" || meStatus === "idle" ? (
        <div className="mx-auto max-w-md rounded-xl bg-white/80 p-4 ring-1 ring-rose-100">
          認証確認中…
        </div>
      ) : meStatus === "error" ? (
        <div className="mx-auto max-w-md space-y-3 rounded-xl bg-white/90 p-4 ring-1 ring-rose-200">
          <div className="font-semibold text-rose-800">通信エラー</div>
          <div className="text-sm text-rose-700 break-all">{meError}</div>
          <button
            onClick={retryAuth}
            className="w-full rounded-xl bg-rose-500 px-4 py-2 font-semibold text-white hover:bg-rose-600"
          >
            再試行
          </button>
        </div>
      ) : meStatus === "unauth" ? (
        <div className="mx-auto max-w-md space-y-3 rounded-xl bg-white/90 p-4 ring-1 ring-rose-200">
          <div className="font-semibold text-rose-800">ログインが必要です</div>
          <div className="text-sm text-rose-700">ログインページへ遷移します…</div>
          <Link href="/login?next=/room" className="block">
            <button className="w-full rounded-xl bg-rose-500 px-4 py-2 font-semibold text-white hover:bg-rose-600">
              ログインへ
            </button>
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-md space-y-4">
          <header className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-rose-100">
            <h1 className="text-xl font-bold text-rose-800">機能選択</h1>
            <div className="mt-2 text-sm text-rose-700">
              accid: <b>{me!.account_id}</b> / room: <b>acc:{me!.account_id}</b> / device: <b>{myDeviceId}</b>
            </div>
            <div className="mt-2 text-sm text-rose-700">
              現在参加者：RECORDER {roster?.counts.recorder ?? 0}/1, SHOOTER {roster?.counts.shooter ?? 0}/4
              {rosterError && <span className="ml-2 text-rose-500">(取得エラー: {rosterError})</span>}
            </div>
          </header>

          <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-rose-100 space-y-3">
            <Link href="/recorder" className="block">
              <button className="w-full rounded-xl bg-rose-500 px-4 py-2 font-semibold text-white hover:bg-rose-600">
                RECORDERページへ
              </button>
            </Link>
            <Link href="/shooter" className="block">
              <button className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600">
                SHOOTERページへ
              </button>
            </Link>
            <Link href="/album" className="block">
              <button className="w-full rounded-xl bg-rose-100 px-4 py-2 font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50">
                アルバムページへ
              </button>
            </Link>
            <Link href="/" className="block">
              <button className="w-full rounded-xl bg-white px-4 py-2 font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50">
                トップへ戻る
              </button>
            </Link>
          </section>
        </div>
      )}
    </main>
  );
}
