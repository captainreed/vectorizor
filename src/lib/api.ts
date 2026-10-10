import { documentSchema, type AppDocument } from '../state/schema';

export interface User {
  id: string;
  username: string;
}

export interface SessionSummary {
  id: string;
  name: string;
  isPublic: boolean;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord extends SessionSummary {
  data: AppDocument;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? `Request failed (${res.status}).`);
  return json as T;
}

/** Run stored data through the schema so older sessions pick up defaults/migrations. */
function record(r: SessionRecord): SessionRecord {
  return { ...r, data: documentSchema.parse(r.data) };
}

export const api = {
  me: () => request<{ user: User | null }>('GET', '/auth/me').then((r) => r.user),
  register: (username: string, password: string) =>
    request<{ user: User }>('POST', '/auth/register', { username, password }).then((r) => r.user),
  login: (username: string, password: string) =>
    request<{ user: User }>('POST', '/auth/login', { username, password }).then((r) => r.user),
  logout: () => request('POST', '/auth/logout'),

  publicSessions: () => request<{ sessions: SessionSummary[] }>('GET', '/sessions/public').then((r) => r.sessions),
  mySessions: () => request<{ sessions: SessionSummary[] }>('GET', '/sessions/mine').then((r) => r.sessions),
  getSession: (id: string) =>
    request<{ session: SessionRecord }>('GET', `/sessions/${encodeURIComponent(id)}`).then((r) => record(r.session)),
  createSession: (body: { name: string; isPublic: boolean; data: AppDocument }) =>
    request<{ session: SessionRecord }>('POST', '/sessions', body).then((r) => record(r.session)),
  copySession: (id: string) =>
    request<{ session: SessionRecord }>('POST', `/sessions/${encodeURIComponent(id)}/copy`).then((r) =>
      record(r.session),
    ),
  updateSession: (id: string, patch: Partial<{ name: string; isPublic: boolean; data: AppDocument }>) =>
    request<{ session: SessionRecord }>('PUT', `/sessions/${encodeURIComponent(id)}`, patch).then((r) =>
      record(r.session),
    ),
  deleteSession: (id: string) => request('DELETE', `/sessions/${encodeURIComponent(id)}`),
};

export function sessionIdFromPath(pathname: string): string | null {
  return /^\/s\/([A-Za-z0-9_-]+)\/?$/.exec(pathname)?.[1] ?? null;
}

export function sessionPath(id: string | null): string {
  return id ? `/s/${id}` : '/';
}
