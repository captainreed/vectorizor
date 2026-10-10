import { useCallback, useEffect, useState } from 'react';
import ImportExport from './ImportExport';
import Modal from './Modal';
import styles from './Sessions.module.css';
import { api, type SessionSummary } from '../../lib/api';
import {
  copySession,
  deleteSession,
  newSession,
  openDialog,
  openSession,
  setSessionPublic,
  useSession,
} from '../../state/session';

type Tab = 'public' | 'mine';

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export default function SessionsDialog() {
  const user = useSession((s) => s.user);
  const currentId = useSession((s) => s.meta?.id);
  const busy = useSession((s) => s.busy);
  const [tab, setTab] = useState<Tab>('public');
  const [list, setList] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => openDialog(null);
  const showing: Tab = user ? tab : 'public';

  const load = useCallback(async () => {
    setError(null);
    try {
      setList(await (showing === 'mine' ? api.mySessions() : api.publicSessions()));
    } catch (e) {
      setList([]);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [showing]);

  useEffect(() => {
    setList(null);
    void load();
  }, [load]);

  const open = async (id: string) => {
    if (await openSession(id)) close();
  };

  const copy = async (id: string) => {
    if (await copySession(id)) close();
  };

  const togglePublic = async (s: SessionSummary) => {
    const updated = await setSessionPublic(s.id, !s.isPublic);
    if (updated) setList((l) => l?.map((x) => (x.id === s.id ? updated : x)) ?? null);
  };

  const remove = async (s: SessionSummary) => {
    if (!window.confirm(`Delete "${s.name}"? This can't be undone.`)) return;
    if (await deleteSession(s.id)) setList((l) => l?.filter((x) => x.id !== s.id) ?? null);
  };

  return (
    <Modal title="Sessions" onClose={close} wide>
      <div className={styles.toolbar}>
        <div className={styles.segmented} role="tablist" aria-label="Session lists">
          <button role="tab" aria-selected={showing === 'public'} onClick={() => setTab('public')}>
            Public
          </button>
          {user && (
            <button role="tab" aria-selected={showing === 'mine'} onClick={() => setTab('mine')}>
              My sessions
            </button>
          )}
        </div>
        <button
          onClick={() => {
            if (newSession()) close();
          }}
        >
          + New session
        </button>
      </div>

      <div className={styles.listWrap}>
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        {list === null ? (
          <p className={styles.empty}>Loading…</p>
        ) : list.length === 0 && !error ? (
          <p className={styles.empty}>
            {showing === 'mine' ? "You haven't saved any sessions yet." : 'No public sessions yet.'}
          </p>
        ) : (
          <ul className={styles.sessionList} aria-label={showing === 'mine' ? 'My sessions' : 'Public sessions'}>
            {list.map((s) => {
              const mine = s.ownerId === user?.id;
              return (
                <li key={s.id} className={s.id === currentId ? styles.current : ''}>
                  <div className={styles.sessionInfo}>
                    <span className={styles.sessionName}>{s.name}</span>
                    <span className={styles.sessionMeta}>
                      {showing === 'public' && <>by {mine ? 'you' : s.ownerName} · </>}
                      {s.isPublic ? 'Public' : 'Private'} · updated {dateFmt.format(new Date(s.updatedAt))}
                      {s.id === currentId && ' · open now'}
                    </span>
                  </div>
                  <div className={styles.rowActions}>
                    {showing === 'mine' && (
                      <label className={styles.publicToggle} title="Public sessions are listed here and can be opened by anyone with the link">
                        <input type="checkbox" checked={s.isPublic} disabled={busy} onChange={() => void togglePublic(s)} />
                        Public
                      </label>
                    )}
                    <button className="primary" disabled={busy} onClick={() => void open(s.id)}>
                      Open
                    </button>
                    {user && (
                      <button disabled={busy} onClick={() => void copy(s.id)} title="Make a private copy in your sessions">
                        Copy
                      </button>
                    )}
                    {showing === 'mine' && (
                      <button className="danger" disabled={busy} onClick={() => void remove(s)} aria-label={`Delete ${s.name}`}>
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!user && (
        <p className={styles.footer}>
          Public sessions can be opened and edited by anyone, but not saved.{' '}
          <button className={styles.link} onClick={() => openDialog('auth')}>
            Log in or create an account
          </button>{' '}
          to save your own sessions and copies.
        </p>
      )}
      <ImportExport />
    </Modal>
  );
}
