// app/album/page.tsx  ← Server Component（"use client" は付けない）
import { Suspense } from "react";
import AlbumClient from "./AlbumClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">読み込み中…</div>}>
      <AlbumClient
        initial={{
          dates: undefined,
          selectedDate: null,
          pictures: undefined,
        }}
      />
    </Suspense>
  );
}