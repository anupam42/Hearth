export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
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
