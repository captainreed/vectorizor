import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthDialog from '../src/components/sessions/AuthDialog';
import SessionsDialog from '../src/components/sessions/SessionsDialog';
import ShareDialog from '../src/components/sessions/ShareDialog';
import QrPanel from '../src/components/sessions/QrPanel';
import type { SessionRecord } from '../src/lib/api';
import { EMPTY_DOCUMENT, useStore } from '../src/state/store';
import { openSession, renameSession, saveSession, useSession } from '../src/state/session';

const alice = { id: 'u-alice', username: 'alice' };
const bob = { id: 'u-bob', username: 'bob' };

const record = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: 'abc123',
  name: 'Plan',
  isPublic: true,
  ownerId: alice.id,
  ownerName: 'alice',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  data: { ...EMPTY_DOCUMENT, axes: { ...EMPTY_DOCUMENT.axes, x: { name: 'Speed', negLabel: 'slow', posLabel: 'fast' } } },
  ...over,
});

let calls: { method: string; path: string; body?: any }[];
let respond: (method: string, path: string, body?: any) => unknown;

beforeEach(() => {
  calls = [];
  respond = () => ({});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const path = url.replace(/^\/api/, '');
      const body = init.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ method, path, body });
      return new Response(JSON.stringify(respond(method, path, body)), { status: 200 });
    }),
  );
  useStore.getState().replaceDocument(EMPTY_DOCUMENT);
  useSession.setState({ user: null, meta: null, name: '', dirty: false, busy: false, notice: null, dialog: null });
  window.history.replaceState(null, '', '/');
});

afterEach(() => vi.unstubAllGlobals());

describe('session state', () => {
  it('opening a shared session loads it without marking it unsaved, and updates the URL', async () => {
    respond = () => ({ session: record() });
    await openSession('abc123', { force: true });
    expect(useStore.getState().axes.x.name).toBe('Speed');
    expect(useSession.getState()).toMatchObject({ name: 'Plan', dirty: false, meta: { id: 'abc123' } });
    expect(window.location.pathname).toBe('/s/abc123');
  });

  it('edits mark the session unsaved; camera/view changes do not', () => {
    useStore.getState().toggleVectors();
    expect(useSession.getState().dirty).toBe(false);
    useStore.getState().addItem();
    expect(useSession.getState().dirty).toBe(true);
  });

  it('saving a new session creates a private one and moves to its URL', async () => {
    useSession.setState({ user: alice });
    useStore.getState().addItem();
    renameSession('Fresh');
    respond = (_m, _p, body) => ({ session: record({ id: 'new1', name: body.name, isPublic: false, data: body.data }) });
    await saveSession();
    expect(calls).toEqual([expect.objectContaining({ method: 'POST', path: '/sessions' })]);
    expect(calls[0].body).toMatchObject({ name: 'Fresh', isPublic: false });
    expect(calls[0].body.data.items).toHaveLength(1);
    expect(useSession.getState()).toMatchObject({ dirty: false, meta: { id: 'new1', isPublic: false } });
    expect(window.location.pathname).toBe('/s/new1');
  });

  it("saving your own session updates it; saving someone else's makes your own copy", async () => {
    respond = () => ({ session: record() });
    await openSession('abc123', { force: true });

    useSession.setState({ user: alice });
    useStore.getState().addItem();
    await saveSession();
    expect(calls.at(-1)).toMatchObject({ method: 'PUT', path: '/sessions/abc123' });

    useSession.setState({ user: bob });
    respond = (_m, _p, body) => ({ session: record({ id: 'bobs', ownerId: bob.id, ownerName: 'bob', isPublic: false, data: body.data }) });
    useStore.getState().addItem();
    await saveSession();
    expect(calls.at(-1)).toMatchObject({ method: 'POST', path: '/sessions' });
    expect(useSession.getState().meta).toMatchObject({ id: 'bobs', ownerId: bob.id });
  });

  it('does nothing when saving as a guest', async () => {
    useStore.getState().addItem();
    await saveSession();
    expect(calls).toEqual([]);
  });
});

describe('sessions dialog', () => {
  it('lists public sessions; guests can open but not copy', async () => {
    respond = () => ({ sessions: [record()] });
    render(<SessionsDialog />);
    expect(await screen.findByText('Plan')).toBeVisible();
    expect(screen.getByText(/by alice/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Open' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'My sessions' })).toBeNull();
  });

  it('has Import and Export at the bottom', async () => {
    respond = () => ({ sessions: [] });
    render(<SessionsDialog />);
    const dialog = screen.getByRole('dialog', { name: 'Sessions' });
    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(screen.getByRole('button', { name: /import/i })).toBeVisible();
    expect(dialog.lastElementChild).toContainElement(exportButton);
    await screen.findByText('No public sessions yet.');
  });

  it('logged-in users can copy a public session into a private one', async () => {
    useSession.setState({ user: bob });
    respond = (method, path) =>
      method === 'POST' && path === '/sessions/abc123/copy'
        ? { session: record({ id: 'copy1', name: 'Copy of Plan', ownerId: bob.id, ownerName: 'bob', isPublic: false }) }
        : { sessions: [record()] };
    render(<SessionsDialog />);
    await userEvent.click(await screen.findByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(useSession.getState().meta).toMatchObject({ id: 'copy1', isPublic: false }));
    expect(useSession.getState().dialog).toBeNull();
    expect(screen.getByRole('tab', { name: 'My sessions' })).toBeVisible();
  });
});

describe('share dialog', () => {
  it('shows the link for a public session', () => {
    useSession.setState({ meta: record() });
    render(<ShareDialog />);
    expect(screen.getByLabelText('Share link')).toHaveValue(`${window.location.origin}/s/abc123`);
  });

  it('asks guests to log in before an unsaved session can be shared', () => {
    render(<ShareDialog />);
    expect(screen.getByText(/log in and save it/i)).toBeVisible();
  });

  it('lets the owner make a private session public', async () => {
    useSession.setState({ user: alice, meta: record({ isPublic: false }) });
    respond = () => ({ session: record({ isPublic: true }) });
    render(<ShareDialog />);
    await userEvent.click(screen.getByRole('button', { name: 'Make public' }));
    expect(calls.at(-1)).toMatchObject({ method: 'PUT', path: '/sessions/abc123', body: { isPublic: true } });
    expect(await screen.findByLabelText('Share link')).toBeVisible();
  });
});

describe('auth dialog', () => {
  it('keeps focus in the password field while typing', async () => {
    render(<AuthDialog />);
    const username = screen.getByLabelText('Username');
    const password = screen.getByLabelText('Password');
    expect(username).toHaveFocus();
    await userEvent.type(username, 'alice');
    await userEvent.click(password);
    await userEvent.keyboard('secret123');
    expect(password).toHaveFocus();
    expect(password).toHaveValue('secret123');
    expect(username).toHaveValue('alice');
  });

  it('creating an account accepts email usernames and explains bad ones on the username field', async () => {
    render(<AuthDialog />);
    await userEvent.click(screen.getByRole('button', { name: /create an account/i }));
    const username = screen.getByLabelText('Username');
    await userEvent.type(username, 'my name');
    expect(username).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent("Spaces can't be used in a username");

    await userEvent.clear(username);
    await userEvent.type(username, 'alice.smith+vz@example.com');
    expect(username).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).toBeNull();
    // Symbols are fine in passwords.
    await userEvent.type(screen.getByLabelText('Password'), 'S3cure!#$%^&*()pw');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'S3cure!#$%^&*()pw');
    respond = () => ({ user: { id: 'u1', username: 'alice.smith+vz@example.com' } });
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(useSession.getState().user).toMatchObject({ username: 'alice.smith+vz@example.com' }));
    expect(calls.at(-1)).toMatchObject({
      path: '/auth/register',
      body: { username: 'alice.smith+vz@example.com', password: 'S3cure!#$%^&*()pw' },
    });
  });
});

describe('QR panel', () => {
  it('shows a QR code for the share link of a public session', () => {
    useSession.setState({ meta: record() });
    render(<QrPanel />);
    const url = `${window.location.origin}/s/abc123`;
    const qr = screen.getByRole('img', { name: `QR code for ${url}` });
    expect(qr.querySelector('path')?.getAttribute('d')).toMatch(/^M\d/);
    expect(screen.getByText(url)).toBeVisible();
  });

  it('explains that a private or unsaved session has no QR code', async () => {
    useSession.setState({ user: alice, meta: record({ isPublic: false }) });
    const { unmount } = render(<QrPanel />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/private. Make it public/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /share options/i }));
    expect(useSession.getState().dialog).toBe('share');
    unmount();

    useSession.setState({ user: null, meta: null });
    render(<QrPanel />);
    expect(screen.getByText(/Save this session and make it public/)).toBeVisible();
  });

  it("warns that a localhost link won't open on other devices", () => {
    // jsdom serves tests from http://localhost:3000.
    useSession.setState({ meta: record() });
    render(<QrPanel />);
    expect(screen.getByText(/other devices can't open/)).toBeVisible();
  });
});
