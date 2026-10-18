import type {
  Catalog,
  Entry,
  Photo,
  Place,
  SessionInfo,
  Trip,
} from "./types";

const CSRF_HEADER = "X-CSRF-Token";
let csrfToken = "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function setCsrfToken(token: string | undefined): void {
  csrfToken = token ?? "";
}

export function getCsrfToken(): string {
  return csrfToken;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (method !== "GET" && path !== "/api/login" && csrfToken) {
    headers[CSRF_HEADER] = csrfToken;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: options.signal,
    });
  } catch {
    if (options.signal?.aborted) throw options.signal.reason;
    throw new ApiError("无法连接服务器，请检查网络后重试", 0);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : response.status === 401
          ? "登录状态已失效，请重新登录"
          : response.status === 409
            ? "该内容仍被引用，暂时无法删除"
            : "请求失败，请稍后重试";
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const api = {
  health: () => request<{ ok: true }>("/api/health"),
  catalog: (signal?: AbortSignal) => request<Catalog>("/api/catalog", { signal }),
  entry: (id: string, signal?: AbortSignal) =>
    request<Entry>(`/api/entries/${encodeURIComponent(id)}`, { signal }),
  session: (signal?: AbortSignal) =>
    request<SessionInfo>("/api/session", { signal }),
  login: (username: string, password: string) =>
    request<SessionInfo>("/api/login", {
      method: "POST",
      body: { username, password },
    }),
  logout: () => request<{ ok: true }>("/api/logout", { method: "POST" }),
  createTrip: (trip: Omit<Trip, "id">) =>
    request<Trip>("/api/trips", { method: "POST", body: trip }),
  updateTrip: (id: string, trip: Omit<Trip, "id">) =>
    request<Trip>(`/api/trips/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: trip,
    }),
  deleteTrip: (id: string) =>
    request<{ ok: true }>(`/api/trips/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  createPlace: (place: Omit<Place, "id">) =>
    request<Place>("/api/places", { method: "POST", body: place }),
  updatePlace: (id: string, place: Omit<Place, "id">) =>
    request<Place>(`/api/places/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: place,
    }),
  deletePlace: (id: string) =>
    request<{ ok: true }>(`/api/places/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  createEntry: (entry: Omit<Entry, "id">) =>
    request<Entry>("/api/entries", { method: "POST", body: entry }),
  updateEntry: (id: string, entry: Omit<Entry, "id">) =>
    request<Entry>(`/api/entries/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: entry,
    }),
  deleteEntry: (id: string) =>
    request<{ ok: true }>(`/api/entries/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  uploadPhoto: (file: File, signal?: AbortSignal) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<Photo>("/api/photos", {
      method: "POST",
      formData,
      signal,
    });
  },
};
