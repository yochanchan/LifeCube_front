export type LoginResponse = {
  token_type: "Bearer";
  access_token: string;
  expires_in: number;      // 秒
  refresh_token?: string;  // 初回ログイン時などに返る
  jti?: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT ?? "").replace(/\/+$/, "");

// ---- localStorage keys ----
const LS_ACCESS = "auth.access";
const LS_ACCESS_EXP = "auth.access_exp";
const LS_REFRESH = "auth.refresh";

// ---- in-memory store ----
type Stored = { access?: string; accessExp?: number; refresh?: string };
const store: Stored = {};

// 初期ロード（SSR等では失敗しても握りつぶす）
(function loadFromStorage() {
  try {
    store.access = localStorage.getItem(LS_ACCESS) || undefined;
    const expStr = localStorage.getItem(LS_ACCESS_EXP);
    store.accessExp = expStr ? Number(expStr) : undefined;
    store.refresh = localStorage.getItem(LS_REFRESH) || undefined;
  } catch {
    // ignore
  }
})();

function saveToStorage() {
  try {
    if (store.access) localStorage.setItem(LS_ACCESS, store.access);
    else localStorage.removeItem(LS_ACCESS);

    if (typeof store.accessExp === "number")
      localStorage.setItem(LS_ACCESS_EXP, String(store.accessExp));
    else localStorage.removeItem(LS_ACCESS_EXP);

    if (store.refresh) localStorage.setItem(LS_REFRESH, store.refresh);
    else localStorage.removeItem(LS_REFRESH);
  } catch {
    // ignore
  }
}

function setTokens(res: LoginResponse) {
  const now = Date.now();
  store.access = res.access_token;
  // 期限は少し前倒し（15秒）
  store.accessExp = now + Math.max(1, res.expires_in - 15) * 1000;
  if (res.refresh_token) store.refresh = res.refresh_token;
  saveToStorage();
}

function clearTokens() {
  store.access = undefined;
  store.accessExp = undefined;
  store.refresh = undefined;
  saveToStorage();
}

// ---- refresh: 同時実行を1回に集約 ----
async function performRefresh(): Promise<boolean> {
  if (!store.refresh) return false;

  const r = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ refresh_token: store.refresh }),
    // JWT 運用なので credentials なし
  });
  if (!r.ok) {
    clearTokens();
    return false;
  }
  const j: LoginResponse = await r.json();
  setTokens(j);
  return true;
}

let refreshPromise: Promise<boolean> | null = null;
async function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function ensureAccess() {
  const now = Date.now();
  if (store.access && store.accessExp && store.accessExp > now) return;
  const ok = await refreshOnce();
  if (!ok) throw new Error("unauthenticated");
}

// ---- 中核: 認証付き fetch（401 のとき 1 回だけ refresh 再試行）----
// ※ cache をここで強制せず、呼び出し側で必要に応じて指定できるようにする
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await ensureAccess();

  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = new Headers(init.headers);
  if (store.access) headers.set("Authorization", `Bearer ${store.access}`);

  const res = await fetch(url, { ...init, headers });
  if (res.status !== 401) return res;

  // 401 → refresh → 1回だけ再試行
  const ok = await refreshOnce();
  if (!ok) return res;

  const headers2 = new Headers(init.headers);
  if (store.access) headers2.set("Authorization", `Bearer ${store.access}`);
  return fetch(url, { ...init, headers: headers2 });
}

// ---- 便利メソッド（JSON系は no-store 推奨） ----
async function getJSON<T>(path: string): Promise<T> {
  const r = await apiFetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

async function postJSON<T>(path: string, body: any): Promise<T> {
  const r = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const r = await apiFetch(path, { method: "POST", body: form, cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const r = await apiFetch(path, { method: "DELETE", cache: "no-store" });
  if (!r.ok && r.status !== 204) throw new Error(`${r.status} ${r.statusText}`);
}

/* ================================
   ▼ 回路遮断: 画像系のflood対策
   - 同時並列を MAX_CONCURRENCY 本に制限
   - 同一URLのリクエストは1本に集約（de-dup）
   - 診断用の第一手としてここで洪水を止める
================================= */

const MAX_CONCURRENCY = 8;
let active = 0;
const queue: Array<() => void> = [];

/** 単純な並列数制限キュー */
function withLimit<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++;
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          const next = queue.shift();
          if (next) next();
        });
    };
    if (active < MAX_CONCURRENCY) run();
    else queue.push(run);
  });
}

/** URL -> Blob の in-flight 集約 */
const inflightBlob = new Map<string, Promise<Blob>>();

/** 認証付きで Blob を取得（401時の自動refreshは apiFetch が担当） */
async function fetchBlobAuth(path: string): Promise<Blob> {
  const r = await apiFetch(path); // ここでは signal を使わない（集約のため）
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.blob();
}

/**
 * 画像など大きいバイナリ向け。
 * - 並列数を制限
 * - 同一URLは1本に集約
 * - 返り値は object URL（revoke は呼び出し側で）
 *
 * 診断のため、いったん AbortSignal は無視して集約/制限を優先。
 * 次のステップで可視域ロードや abort を入れる。
 */
async function getObjectUrl(path: string /*, signal?: AbortSignal */): Promise<string> {
  const key = path;

  let p = inflightBlob.get(key);
  if (!p) {
    p = withLimit(() => fetchBlobAuth(path));
    inflightBlob.set(key, p);
  }

  try {
    const blob = await p;
    return URL.createObjectURL(blob);
  } finally {
    // このURLの取得が終わったら in-flight を解除（次回は新規取得）
    p.finally(() => inflightBlob.delete(key));
  }
}

// ---- 公開 ----
export const apiclient = {
  base: API_BASE,
  setTokens,
  clearTokens,
  getJSON,
  postJSON,
  postForm,
  del,
  getObjectUrl,
  fetch: apiFetch,
};
