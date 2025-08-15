// src/lib/deviceId.ts
export function ensureDeviceId(): string {
  // SSR/Edge では window が無い
  if (typeof window === "undefined") return "server"; // 一時値（クライアントで上書き）

  const KEY = "device_uid_v1";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      const rnd =
        (window.crypto && "randomUUID" in window.crypto)
          ? window.crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      id = `dev_${rnd}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // まれにプライベートモード等で localStorage が使えない
    return `dev_fallback_${Date.now().toString(36)}`;
  }
}
