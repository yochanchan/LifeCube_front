// src/app/room/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

export default function RoomSelectPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [roster, setRoster] = useState<Roster | null>(null);
  const myDeviceId = useMemo(getOrCreateDeviceId, []);
  const room = me ? `acc:${me.account_id}` : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include", cache: "no-store" });
        if (!res.ok) throw new Error("unauth");
        const j = (await res.json()) as Me;
        if (!cancelled) setMe(j);
      } catch {
        if (!cancelled) router.replace(`/login?next=/room`);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!authChecked || !room) return;
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(`${API_BASE}/ws/roster`, window.location.href);
        url.searchParams.set("room", room);
        const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const j = (await res.json()) as Roster;
          if (!cancelled) setRoster(j);
        }
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [authChecked, room]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-pink-50 to-purple-50 p-4">
      {!authChecked || !me ? (
        <div className="mx-auto max-w-md rounded-xl bg-white/80 p-4 ring-1 ring-rose-100">認証確認中…</div>
      ) : (
        <div className="mx-auto max-w-md space-y-4">
          <header className="rounded-2xl bg-white/70 p-4 shadow-sm ring-1 ring-rose-100">
            <h1 className="text-xl font-bold text-rose-800">機能選択</h1>
            <div className="mt-2 text-sm text-rose-700">
              accid: <b>{me.account_id}</b> / room: <b>acc:{me.account_id}</b> / device: <b>{myDeviceId}</b>
            </div>
            <div className="mt-2 text-sm text-rose-700">
              現在参加者：RECORDER {roster?.counts.recorder ?? 0}/1, SHOOTER {roster?.counts.shooter ?? 0}/4
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
