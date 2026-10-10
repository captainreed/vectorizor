import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { PASSWORD_MIN, SESSION_NAME_MAX, documentSchema, publicName, usernameProblem } from '../src/state/schema';
import { createLimiter, hashPassword, hashToken, randomId, verifyPassword } from './auth';
import { openDb } from './db';

export const COOKIE_NAME = 'vz_auth';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const usernameSchema = z
  .string()
  .trim()
  .superRefine((name, ctx) => {
    const problem = usernameProblem(name);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });
const credentialsSchema = z.object({
  username: usernameSchema,
  password: z.string().min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`).max(200),
});
const sessionNameSchema = z.string().trim().min(1, 'Give the session a name.').max(SESSION_NAME_MAX);
const createSessionSchema = z.object({
  name: sessionNameSchema,
  isPublic: z.boolean().default(false),
  data: documentSchema,
});
const updateSessionSchema = z
  .object({ name: sessionNameSchema, isPublic: z.boolean(), data: documentSchema })
  .partial();

interface UserRow {
  id: string;
  username: string;
}

interface SessionRow {
  id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  is_public: number;
  data: string;
  created_at: string;
  updated_at: string;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? 'Invalid request.');
  return r.data;
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function summary(r: SessionRow) {
  return {
    id: r.id,
    name: r.name,
    isPublic: r.is_public === 1,
    ownerId: r.owner_id,
    // Lists and shared links are visible to anyone, so never expose an email username in full.
    ownerName: publicName(r.owner_name),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * The JSON API, mounted under /api. Requests outside /api fall through to `next`, so this can sit
 * in front of Vite's dev/preview server.
 */
export function createApiApp({ dbPath }: { dbPath: string }) {
  const db = openDb(dbPath);
  const loginLimiter = createLimiter(20, 15 * 60 * 1000);

  const q = {
    userByName: db.prepare<[string], UserRow & { password_hash: string }>(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
    ),
    insertUser: db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)'),
    userByToken: db.prepare<[string, number], UserRow>(
      `SELECT u.id, u.username FROM auth_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.expires_at > ?`,
    ),
    insertToken: db.prepare('INSERT INTO auth_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    deleteToken: db.prepare('DELETE FROM auth_tokens WHERE token_hash = ?'),
    purgeTokens: db.prepare('DELETE FROM auth_tokens WHERE expires_at <= ?'),
    session: db.prepare<[string], SessionRow>(
      `SELECT s.*, u.username AS owner_name FROM sessions s JOIN users u ON u.id = s.owner_id WHERE s.id = ?`,
    ),
    publicSessions: db.prepare<[], SessionRow>(
      `SELECT s.*, u.username AS owner_name FROM sessions s JOIN users u ON u.id = s.owner_id
       WHERE s.is_public = 1 ORDER BY s.updated_at DESC`,
    ),
    mySessions: db.prepare<[string], SessionRow>(
      `SELECT s.*, u.username AS owner_name FROM sessions s JOIN users u ON u.id = s.owner_id
       WHERE s.owner_id = ? ORDER BY s.updated_at DESC`,
    ),
    insertSession: db.prepare(
      `INSERT INTO sessions (id, owner_id, name, is_public, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    updateSession: db.prepare(
      'UPDATE sessions SET name = ?, is_public = ?, data = ?, updated_at = ? WHERE id = ?',
    ),
    deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
  };

  const currentUser = (req: Request): UserRow | null => {
    const token = readCookie(req, COOKIE_NAME);
    return token ? (q.userByToken.get(hashToken(token), Date.now()) ?? null) : null;
  };

  const requireUser = (req: Request): UserRow => {
    const user = currentUser(req);
    if (!user) throw new HttpError(401, 'Log in to do that.');
    return user;
  };

  const startLogin = (res: Response, user: UserRow) => {
    q.purgeTokens.run(Date.now());
    const token = randomId(32);
    q.insertToken.run(hashToken(token), user.id, Date.now() + TOKEN_TTL_MS);
    // Lax keeps the cookie off cross-site POSTs; the API also only accepts JSON bodies.
    res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', maxAge: TOKEN_TTL_MS, path: '/' });
    res.json({ user: { id: user.id, username: user.username } });
  };

  /** A session the requester may read: public ones, or their own. Others 404 so ids don't leak. */
  const readableSession = (req: Request, id: string): SessionRow => {
    const row = q.session.get(id);
    if (!row || (row.is_public !== 1 && row.owner_id !== currentUser(req)?.id)) {
      throw new HttpError(404, 'That session does not exist or is private.');
    }
    return row;
  };

  const ownSession = (req: Request, id: string): SessionRow => {
    const user = requireUser(req);
    const row = q.session.get(id);
    if (!row || row.owner_id !== user.id) throw new HttpError(404, 'That session does not exist.');
    return row;
  };

  const sessionJson = (row: SessionRow) => ({ ...summary(row), data: JSON.parse(row.data) });

  const createSession = (ownerId: string, name: string, isPublic: boolean, data: unknown) => {
    const id = randomId();
    const now = new Date().toISOString();
    q.insertSession.run(id, ownerId, name, isPublic ? 1 : 0, JSON.stringify(data), now, now);
    return sessionJson(q.session.get(id)!);
  };

  const api = express.Router();
  api.use(express.json({ limit: '1mb' }));

  api.get('/auth/me', (req, res) => {
    res.json({ user: currentUser(req) });
  });

  api.post('/auth/register', (req, res) => {
    const { username, password } = parse(credentialsSchema, req.body);
    if (q.userByName.get(username)) throw new HttpError(409, 'That username is taken.');
    const user = { id: randomId(), username };
    q.insertUser.run(user.id, username, hashPassword(password), new Date().toISOString());
    startLogin(res, user);
  });

  api.post('/auth/login', (req, res) => {
    const key = req.ip ?? 'unknown';
    if (loginLimiter.blocked(key)) throw new HttpError(429, 'Too many failed logins. Try again later.');
    const body = z.object({ username: z.string().trim(), password: z.string() }).safeParse(req.body);
    const row = body.success ? q.userByName.get(body.data.username) : undefined;
    if (!body.success || !row || !verifyPassword(body.data.password, row.password_hash)) {
      loginLimiter.hit(key);
      throw new HttpError(401, 'Wrong username or password.');
    }
    startLogin(res, row);
  });

  api.post('/auth/logout', (req, res) => {
    const token = readCookie(req, COOKIE_NAME);
    if (token) q.deleteToken.run(hashToken(token));
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  api.get('/sessions/public', (_req, res) => {
    res.json({ sessions: q.publicSessions.all().map(summary) });
  });

  api.get('/sessions/mine', (req, res) => {
    res.json({ sessions: q.mySessions.all(requireUser(req).id).map(summary) });
  });

  api.get('/sessions/:id', (req, res) => {
    res.json({ session: sessionJson(readableSession(req, req.params.id)) });
  });

  api.post('/sessions', (req, res) => {
    const user = requireUser(req);
    const { name, isPublic, data } = parse(createSessionSchema, req.body);
    res.status(201).json({ session: createSession(user.id, name, isPublic, data) });
  });

  /** Copy a readable session into a new private one owned by the requester. */
  api.post('/sessions/:id/copy', (req, res) => {
    const user = requireUser(req);
    const source = readableSession(req, req.params.id);
    const name = `Copy of ${source.name}`.slice(0, SESSION_NAME_MAX);
    res.status(201).json({ session: createSession(user.id, name, false, JSON.parse(source.data)) });
  });

  api.put('/sessions/:id', (req, res) => {
    const row = ownSession(req, req.params.id);
    const patch = parse(updateSessionSchema, req.body);
    q.updateSession.run(
      patch.name ?? row.name,
      (patch.isPublic ?? row.is_public === 1) ? 1 : 0,
      patch.data ? JSON.stringify(patch.data) : row.data,
      new Date().toISOString(),
      row.id,
    );
    res.json({ session: sessionJson(q.session.get(row.id)!) });
  });

  api.delete('/sessions/:id', (req, res) => {
    q.deleteSession.run(ownSession(req, req.params.id).id);
    res.json({ ok: true });
  });

  api.use((_req, _res) => {
    throw new HttpError(404, 'Not found.');
  });

  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
    // body-parser errors (malformed JSON, body too large) carry a client-error status.
    const status = (err as { status?: unknown })?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return void res.status(status).json({ error: status === 413 ? 'That session is too large.' : 'Bad request.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  const app = express();
  app.disable('x-powered-by');
  app.use('/api', api);
  return Object.assign(app, { close: () => db.close() });
}
