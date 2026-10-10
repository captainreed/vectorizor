// @vitest-environment node
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApiApp } from '../server/app';
import { EMPTY_DOCUMENT } from '../src/state/store';

let server: Server;
let app: ReturnType<typeof createApiApp>;
let base: string;

beforeEach(async () => {
  app = createApiApp({ dbPath: ':memory:' });
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterEach(async () => {
  await new Promise((r) => server.close(r));
  app.close();
});

/** A cookie-keeping client, one per simulated browser. */
function client() {
  let cookie = '';
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, json: (await res.json()) as Record<string, any> };
  };
}

const doc = { ...EMPTY_DOCUMENT, items: [] };

describe('accounts', () => {
  it('registers, stays logged in via cookie, logs out', async () => {
    const c = client();
    expect((await c('GET', '/auth/me')).json.user).toBeNull();
    const reg = await c('POST', '/auth/register', { username: 'alice', password: 'password1' });
    expect(reg.status).toBe(200);
    expect(reg.json.user.username).toBe('alice');
    expect((await c('GET', '/auth/me')).json.user.username).toBe('alice');
    await c('POST', '/auth/logout');
    expect((await c('GET', '/auth/me')).json.user).toBeNull();
  });

  it('rejects duplicate usernames (case-insensitive), weak passwords, and wrong logins', async () => {
    const c = client();
    await c('POST', '/auth/register', { username: 'alice', password: 'password1' });
    expect((await c('POST', '/auth/register', { username: 'ALICE', password: 'password1' })).status).toBe(409);
    expect((await c('POST', '/auth/register', { username: 'bob', password: 'short' })).status).toBe(400);
    expect((await c('POST', '/auth/login', { username: 'alice', password: 'nope-nope' })).status).toBe(401);
    expect((await c('POST', '/auth/login', { username: 'alice', password: 'password1' })).status).toBe(200);
  });

  it('allows any symbols in passwords but explains bad usernames', async () => {
    const c = client();
    const bad = await c('POST', '/auth/register', { username: 'my name', password: 'password1' });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/Spaces can't be used in a username/);
    expect((await c('POST', '/auth/register', { username: 'bad#name', password: 'password1' })).json.error).toMatch(
      /"#" can't be used/,
    );
    const ok = await c('POST', '/auth/register', { username: 'carol.b-2', password: 'p@ss w0rd!#$%^&*()' });
    expect(ok.status).toBe(200);
    expect((await client()('POST', '/auth/login', { username: 'carol.b-2', password: 'p@ss w0rd!#$%^&*()' })).status).toBe(200);
  });
});

describe('email usernames', () => {
  it('can register and log in with an email address (case-insensitive)', async () => {
    const c = client();
    const reg = await c('POST', '/auth/register', { username: 'Alice.Smith+vz@Example.com', password: 'password1' });
    expect(reg.status).toBe(200);
    expect(reg.json.user.username).toBe('Alice.Smith+vz@Example.com');
    const login = await client()('POST', '/auth/login', { username: 'alice.smith+vz@example.com', password: 'password1' });
    expect(login.status).toBe(200);
    expect((await c('POST', '/auth/register', { username: 'alice.smith+vz@example.com', password: 'password1' })).status).toBe(409);
  });

  it("never shows another user's email domain in public session listings", async () => {
    const alice = client();
    await alice('POST', '/auth/register', { username: 'alice@example.com', password: 'password1' });
    const id = (await alice('POST', '/sessions', { name: 'Plan', isPublic: true, data: doc })).json.session.id;
    const listed = (await client()('GET', '/sessions/public')).json.sessions[0];
    expect(listed.ownerName).toBe('alice');
    const shared = (await client()('GET', `/sessions/${id}`)).json.session;
    expect(JSON.stringify(shared)).not.toContain('example.com');
  });
});

describe('sessions', () => {
  it('requires login to save', async () => {
    const guest = client();
    expect((await guest('POST', '/sessions', { name: 'x', data: doc })).status).toBe(401);
  });

  it('keeps private sessions private and lists public ones for everyone', async () => {
    const alice = client();
    const guest = client();
    await alice('POST', '/auth/register', { username: 'alice', password: 'password1' });
    const created = await alice('POST', '/sessions', { name: 'Mine', data: doc });
    expect(created.status).toBe(201);
    const id = created.json.session.id;
    expect(created.json.session.isPublic).toBe(false);

    expect((await guest('GET', `/sessions/${id}`)).status).toBe(404);
    expect((await guest('GET', '/sessions/public')).json.sessions).toHaveLength(0);
    expect((await alice('GET', `/sessions/${id}`)).status).toBe(200);

    await alice('PUT', `/sessions/${id}`, { isPublic: true });
    const shared = await guest('GET', `/sessions/${id}`);
    expect(shared.status).toBe(200);
    expect(shared.json.session).toMatchObject({ name: 'Mine', ownerName: 'alice', isPublic: true });
    expect(shared.json.session.data.axes.x.name).toBe('X');
    expect((await guest('GET', '/sessions/public')).json.sessions.map((s: any) => s.id)).toEqual([id]);
  });

  it("only the owner can update or delete; others can copy a public session into a private one", async () => {
    const alice = client();
    const bob = client();
    await alice('POST', '/auth/register', { username: 'alice', password: 'password1' });
    await bob('POST', '/auth/register', { username: 'bob', password: 'password1' });
    const id = (await alice('POST', '/sessions', { name: 'Plan', isPublic: true, data: doc })).json.session.id;

    expect((await bob('PUT', `/sessions/${id}`, { name: 'Hijack' })).status).toBe(404);
    expect((await bob('DELETE', `/sessions/${id}`)).status).toBe(404);

    const copy = await bob('POST', `/sessions/${id}/copy`);
    expect(copy.status).toBe(201);
    expect(copy.json.session).toMatchObject({ name: 'Copy of Plan', ownerName: 'bob', isPublic: false });
    expect((await bob('GET', '/sessions/mine')).json.sessions).toHaveLength(1);
    expect((await alice('GET', `/sessions/${copy.json.session.id}`)).status).toBe(404);

    expect((await alice('DELETE', `/sessions/${id}`)).status).toBe(200);
    expect((await bob('GET', `/sessions/${id}`)).status).toBe(404);
  });

  it('cannot copy a private session it cannot read', async () => {
    const alice = client();
    const bob = client();
    await alice('POST', '/auth/register', { username: 'alice', password: 'password1' });
    await bob('POST', '/auth/register', { username: 'bob', password: 'password1' });
    const id = (await alice('POST', '/sessions', { name: 'Secret', data: doc })).json.session.id;
    expect((await bob('POST', `/sessions/${id}/copy`)).status).toBe(404);
  });

  it('validates session data against the document schema', async () => {
    const alice = client();
    await alice('POST', '/auth/register', { username: 'alice', password: 'password1' });
    expect((await alice('POST', '/sessions', { name: 'Bad', data: { items: 'nope' } })).status).toBe(400);
    expect((await alice('POST', '/sessions', { name: '', data: doc })).status).toBe(400);
  });
});
