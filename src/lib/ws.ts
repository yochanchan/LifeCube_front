// src/lib/ws.ts
export type WsMessage =
  | { type: "take_photo"; origin_device_id: string; ts?: number }
  | { type: "photo_uploaded"; seq: number; picture_id: number; device_id: string; image_url: string; pictured_at?: string }
  | { type: "ping" }
  | { type: "pong" }
  | { type: string;[k: string]: any };

export function buildWsUrl(rawBase: string, room: string, deviceId: string) {
  const u = new URL(rawBase); // 例: ws://localhost:8000
  if (!u.pathname || u.pathname === "/") {
    u.pathname = "/ws"; // ★ パス未指定なら /ws に補正
  }
  u.searchParams.set("room", room);
  u.searchParams.set("device_id", deviceId);
  return u;
}

export function safeSend(ws: WebSocket | null, data: unknown) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(typeof data === "string" ? data : JSON.stringify(data));
  } catch {
    return false;
  }
  return true;
}
