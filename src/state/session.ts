import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  api,
  sessionIdFromPath,
  sessionPath,
  type SessionRecord,
  type SessionSummary,
  type User,
} from '../lib/api';
import { EMPTY_DOCUMENT, getDocument, restoredLegacyDraft, useStore } from './store';
import type { AppDocument } from './schema';

export const DEFAULT_SESSION_NAME = 'Untitled session';

export type DialogId = 'sessions' | 'auth' | 'share' | null;

export interface Notice {
  kind: 'error' | 'info';
  text: string;
}

interface SessionState {
  user: User | null;
  /** The saved session being viewed, or null for a new one that has never been saved. */
  meta: SessionSummary | null;
  name: string;
  /** The working copy differs from what was last opened or saved. */
  dirty: boolean;
  busy: boolean;
  notice: Notice | null;
  dialog: DialogId;
}

export const useSession = create<SessionState>()(
  persist(
    (): SessionState => ({
      user: null,
      meta: null,
      name: '',
      dirty: false,
      busy: false,
      notice: null,
      dialog: null,
    }),
    {
      // Per tab, like the working document, so a reload keeps which session is open.
      name: 'vectorizor:session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ meta: s.meta, name: s.name, dirty: s.dirty }),
    },
  ),
);

const set = useSession.setState;
const get = useSession.getState;

export const selectIsOwner = (s: SessionState): boolean => !!s.user && s.meta?.ownerId === s.user.id;

export function shareUrl(id: string): string {
  return `${window.location.origin}${sessionPath(id)}`;
}

export function openDialog(dialog: DialogId) {
  set({ dialog });
}

export function setNotice(notice: Notice | null) {
  set({ notice });
}

export function renameSession(name: string) {
  set({ name, dirty: true });
}

// Every document edit bumps editSeq so a save can tell whether more edits landed while it ran.
// Loading a session replaces the document without counting as an edit. Camera/view changes are
// saved with the session but don't mark it unsaved on their own.
let editSeq = 0;
let loading = false;
useStore.subscribe((s, prev) => {
  if (loading) return;
  if (s.items !== prev.items || s.axes !== prev.axes || s.modes !== prev.modes || s.person !== prev.person) {
    editSeq++;
    if (!get().dirty) set({ dirty: true });
  }
});

type History = 'push' | 'replace' | 'none';

function summarize({ data: _data, ...meta }: SessionRecord): SessionSummary {
  return meta;
}

function navigate(path: string, history: History) {
  if (history === 'none' || window.location.pathname === path) return;
  if (history === 'push') window.history.pushState(null, '', path);
  else window.history.replaceState(null, '', path);
}

function show(rec: SessionRecord | null, doc: AppDocument, history: History) {
  loading = true;
  try {
    useStore.getState().replaceDocument(doc);
  } finally {
    loading = false;
  }
  set({ meta: rec && summarize(rec), name: rec?.name ?? '', dirty: false });
  navigate(sessionPath(rec?.id ?? null), history);
}

function confirmDiscard(): boolean {
  const { dirty, name } = get();
  return !dirty || window.confirm(`Discard unsaved changes to "${name || DEFAULT_SESSION_NAME}"?`);
}

function fail(e: unknown) {
  set({ notice: { kind: 'error', text: e instanceof Error ? e.message : String(e) } });
}

async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
  set({ busy: true });
  try {
    return await task();
  } catch (e) {
    fail(e);
    return undefined;
  } finally {
    set({ busy: false });
  }
}

export async function refreshUser() {
  try {
    set({ user: await api.me() });
  } catch {
    // Server unreachable: carry on as a guest.
  }
}

/** Log in or create an account. Throws on failure so the form can show the message. */
export async function authenticate(mode: 'login' | 'register', username: string, password: string) {
  const user = mode === 'login' ? await api.login(username, password) : await api.register(username, password);
  set({ user, dialog: null, notice: { kind: 'info', text: `Logged in as ${user.username}.` } });
}

export async function logout() {
  await run(() => api.logout());
  set({ user: null });
}

export function newSession(): boolean {
  if (!confirmDiscard()) return false;
  show(null, EMPTY_DOCUMENT, 'push');
  return true;
}

export async function openSession(id: string, { history = 'push', force = false }: { history?: History; force?: boolean } = {}) {
  if (!force && !confirmDiscard()) return false;
  const rec = await run(() => api.getSession(id));
  if (rec) show(rec, rec.data, history);
  return !!rec;
}

/** Save the working copy: updates your own session, otherwise creates a new private one. */
export async function saveSession() {
  const { user, meta } = get();
  if (!user) return;
  const name = get().name.trim() || DEFAULT_SESSION_NAME;
  const data = getDocument();
  const seq = editSeq;
  const rec = await run(() =>
    meta && meta.ownerId === user.id
      ? api.updateSession(meta.id, { name, data })
      : api.createSession({ name, isPublic: false, data }),
  );
  if (!rec) return;
  set({ meta: summarize(rec), name: rec.name, dirty: editSeq !== seq || get().name.trim() !== rec.name });
  navigate(sessionPath(rec.id), 'push');
  set({ notice: { kind: 'info', text: meta && meta.ownerId === user.id ? 'Saved.' : 'Saved to your sessions (private).' } });
}

/** Copy a saved session into a new private one and open it. */
export async function copySession(id: string) {
  if (!confirmDiscard()) return false;
  const rec = await run(() => api.copySession(id));
  if (!rec) return false;
  show(rec, rec.data, 'push');
  set({ notice: { kind: 'info', text: `Copied to your sessions as "${rec.name}" (private).` } });
  return true;
}

export async function setSessionPublic(id: string, isPublic: boolean) {
  const rec = await run(() => api.updateSession(id, { isPublic }));
  if (rec && get().meta?.id === id) set({ meta: summarize(rec) });
  return rec && summarize(rec);
}

export async function deleteSession(id: string) {
  const ok = await run(() => api.deleteSession(id));
  if (ok === undefined) return false;
  // Keep what's on screen as a new unsaved session rather than yanking it away.
  if (get().meta?.id === id) {
    set({ meta: null, dirty: true });
    navigate('/', 'replace');
  }
  return true;
}

/** Load an imported file into the working copy; it stays unsaved until saved. */
export function importDocument(doc: AppDocument, name?: string) {
  useStore.getState().replaceDocument(doc);
  if (name && !get().meta) set({ name });
}

async function onPopState() {
  const id = sessionIdFromPath(window.location.pathname);
  const current = get().meta?.id ?? null;
  if (id === current) return;
  if (!confirmDiscard()) {
    window.history.pushState(null, '', sessionPath(current));
    return;
  }
  if (id) {
    if (!(await openSession(id, { history: 'none', force: true }))) show(null, EMPTY_DOCUMENT, 'replace');
  } else {
    show(null, EMPTY_DOCUMENT, 'none');
  }
}

/** Sync the open session with the URL (/ or /s/:id), and wire up history and unload guards. */
export async function bootSession() {
  window.addEventListener('popstate', () => void onPopState());
  window.addEventListener('beforeunload', (e) => {
    if (!get().dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
  if (restoredLegacyDraft && useStore.getState().items.length > 0) {
    set({ dirty: true, notice: { kind: 'info', text: 'Restored your earlier work. Log in and save it to keep it.' } });
  }

  const user = refreshUser();
  const id = sessionIdFromPath(window.location.pathname);
  const { meta } = get();
  if (id && meta?.id !== id) {
    if (!(await openSession(id, { history: 'replace', force: true }))) show(null, EMPTY_DOCUMENT, 'replace');
  } else if (!id && meta) {
    // The draft in this tab belongs to a saved session, but the URL asks for a new one.
    show(null, EMPTY_DOCUMENT, 'none');
  }
  await user;
}
