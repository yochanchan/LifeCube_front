// frontend/src/app/mic_camera/page.tsx
import { Suspense } from "react";
import MicCameraClient from "./MicCameraClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">読み込み中…</div>}>
      <MicCameraClient />
    </Suspense>
  );
}
