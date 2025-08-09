// app/album/page.tsx  (Server Component)
import { Suspense } from "react";
import AlbumClient from "./AlbumClient"; // ← クライアント子

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");

export default async function Page({
  searchParams,
}: {
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  const tripId = typeof searchParams?.trip_id === "string" ? searchParams!.trip_id : null;

  // サーバーで取れるなら事前取得（cookieでも可）
  const accountId = process.env.NEXT_PUBLIC_ACCOUNT_ID ?? null;

  let initial = {
    accountId,
    dates: undefined as string[] | undefined,
    selectedDate: null as string | null,
    pictures: undefined as any[] | undefined,
  };

  if (accountId) {
    const q = new URLSearchParams({ account_id: accountId });
    if (tripId) q.set("trip_id", tripId);

    const datesRes = await fetch(`${API_BASE}/api/pictures/dates?${q}`, { cache: "no-store" });
    if (datesRes.ok) {
      initial.dates = await datesRes.json();
      initial.selectedDate = initial.dates.at(-1) ?? null;

      if (initial.selectedDate) {
        const qp = new URLSearchParams({
          date: initial.selectedDate,
          thumb_w: "256",
          account_id: accountId,
        });
        if (tripId) qp.set("trip_id", tripId);
        const picsRes = await fetch(`${API_BASE}/api/pictures/by-date?${qp}`, { cache: "no-store" });
        if (picsRes.ok) initial.pictures = await picsRes.json();
      }
    }
  }

  return (
    <Suspense fallback={<div className="p-4">読み込み中…</div>}>
      <AlbumClient tripId={tripId} initial={initial} />
    </Suspense>
  );
}
