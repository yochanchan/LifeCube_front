// app/album/page.tsx  (Server Component)
import { Suspense } from "react";
import AlbumClient from "./AlbumClient"; // クライアント側の描画コンポーネント

// API ベースURL（SSRでも環境変数から解決）
const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");

export default async function Page({
  searchParams,
}: {
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  // URL の ?trip_id=... を SSR で解決（なければ null）
  const tripId = typeof searchParams?.trip_id === "string" ? searchParams!.trip_id : null;

  // SSR時に分かる account_id（PoCでは環境変数で擬似的に）
  const accountId = process.env.NEXT_PUBLIC_ACCOUNT_ID ?? null;

  // クライアントに渡す初期データの箱
  let initial = {
    accountId,
    dates: undefined as string[] | undefined,
    selectedDate: null as string | null,
    pictures: undefined as any[] | undefined, // ← 型はクライアント側で PictureMeta に合流
  };

  /**
   * ===== 可能なら SSR で先読み =====
   * - アルバム日付 → その最新日付の一覧、の順でフェッチ
   * - 失敗したら無視（クライアントのSWRが改めて取りに行く）
   */
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
      {/* クライアントへバトン。SWRの fallbackData に初期値として渡される */}
      <AlbumClient tripId={tripId} initial={initial} />
    </Suspense>
  );
}
