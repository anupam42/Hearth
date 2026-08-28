import { signal } from "../core/reactive.js";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** True when the server (or the proxy in front of it) is unreachable — not a normal API error. */
export const apiDown = signal(false);

/**
 * Flips true on any 401 response. Not meaningful on its own — a 401 is also the normal,
 * expected result of checking auth state while logged out. Callers should only act on this
 * when they already believed the user was logged in (see app.ts).
 */
export const unauthorized = signal(false);

// Gateway-style statuses mean "couldn't reach the upstream server" even when a response
// came back at all (e.g. our dev proxy returns 502 instead of a network exception when
// the backend is down) — treat those the same as a hard network failure.
const GATEWAY_ERROR_STATUSES = new Set([502, 503, 504]);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : {},
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    apiDown.set(true);
    throw new ApiError(0, "network error");
  }

  if (GATEWAY_ERROR_STATUSES.has(res.status)) {
    apiDown.set(true);
    throw new ApiError(res.status, res.statusText);
  }
  apiDown.set(false);

  if (!res.ok) {
    if (res.status === 401) unauthorized.set(true);
    const payload = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, payload.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export interface User {
  id: string;
  email: string;
  display_name: string;
  system_role: string;
  created_at: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  key: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface AccessToken {
  id: string;
  name: string;
  permission: string;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface CreateAccessTokenResponse extends AccessToken {
  secret: string;
}

export interface Task {
  id: string;
  project_id: string;
  seq: number;
  display_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
