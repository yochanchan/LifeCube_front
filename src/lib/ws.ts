// src/lib/ws.ts
export type WsMessage =
  | { type: "take_photo"; origin_device_id: string; ts?: number }
  | { type: "photo_uploaded"; seq: number; picture_id: number; device_id: string; image_url: string; pictured_at?: string }
  | { type: "join_ok"; role: "recorder" | "shooter"; limits: { recorder_max: number; shooter_max: number } }
  | { type: "join_denied"; reason: "invalid_role" | "recorder_full" | "shooter_full" }
  | { type: "roster_update"; recorder: string | null; shooters: string[]; counts: { recorder: number; shooter: number } }
  | { type: "recorder_granted"; device_id: string; ttl: number; deadline: number }
  | { type: "recorder_denied"; holder_device_id: string | null }
  | { type: "recorder_revoked"; device_id: string; reason: "expired" | "released" | "disconnected" }
  | { type: "ping" }
  | { type: "pong" }
  | { type: string;[k: string]: any };

export function buildWsUrl(rawBase: string, room: string, deviceId: string) {
  const u = new URL(rawBase); // 例: ws://localhost:8000
  if (!u.pathname || u.pathname === "/") {
    u.pathname = "/ws";
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
