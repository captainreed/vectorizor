import { useEffect, useRef, useState } from 'react';
import styles from './TabBar.module.css';
import { selectIsolatePlane, useStore } from '../state/store';
import {
  MODE_IDS,
  PLANE_IDS,
  SESSION_NAME_MAX,
  type IsolatePlane,
  type ModeId,
  type Preset,
} from '../state/schema';
import {
  DEFAULT_SESSION_NAME,
  logout,
  openDialog,
  renameSession,
  saveSession,
  selectIsOwner,
  setNotice,
  useSession,
} from '../state/session';
import { activeCompassPlanes } from '../lib/coords';

const PRESET_LABELS: Record<Preset, string> = {
  front: 'Front (XY)',
  top: 'Top (XZ)',
  side: 'Side (YZ)',
  iso: 'Isometric',
};

const PLANE_SHORT: Record<IsolatePlane, string> = { xy: 'XY', xz: 'XZ', yz: 'YZ', 'ne-y': 'NE–Y', 'nw-y': 'NW–Y' };

const MODE_LABELS: Record<ModeId, string> = { person: 'Person', push: 'Push', single: 'Single', result: 'Result' };

const MODE_HINTS: Record<ModeId, string> = {
  person: 'Show a person sphere at the center',
  push: 'Draw each vector as a force pushing on the person sphere (turns on Person)',
  single: "Combine each item's axis values into one 3D vector (their sum)",
  result: 'Move the person to where the dots pulling on it like springs balance: their average position (turns on Person)',
};

type MenuId = 'preset' | 'isolate' | 'modes' | null;

export default function TabBar() {
  const view = useStore((s) => s.view);
  const setViewMode = useStore((s) => s.setViewMode);
  const setPreset = useStore((s) => s.setPreset);
  const setIsolatePlane = useStore((s) => s.setIsolatePlane);
  const modes = useStore((s) => s.modes);
  const toggleMode = useStore((s) => s.toggleMode);
  const modesOn = MODE_IDS.filter((m) => modes[m]).length;
  const isolatePlane = useStore(selectIsolatePlane);
  // Compass planes can be isolated while they're shown (some item uses one of their diagonals).
  const items = useStore((s) => s.items);
  const isolateChoices = [...PLANE_IDS, ...activeCompassPlanes(items)];
  const [menu, setMenu] = useState<MenuId>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!barRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const tabClass = (active: boolean) => `${styles.tab} ${active ? styles.active : ''}`;

  return (
    <div className={styles.bar} ref={barRef}>
      <div className={styles.brand}>Vectorizor</div>
      <SessionName />
      <div className={styles.tabs}>
        <nav className={styles.tabGroup} role="tablist" aria-label="View configuration">
          <button role="tab" aria-selected={view.mode === 'free'} className={tabClass(view.mode === 'free')} onClick={() => setViewMode('free')}>
            Free 3D
          </button>
          <button role="tab" aria-selected={view.mode === 'vectors'} className={tabClass(view.mode === 'vectors')} onClick={() => setViewMode('vectors')}>
            Vectors
          </button>

          <div className={styles.menuWrap}>
            <button
              role="tab"
              aria-selected={view.mode === 'preset'}
              aria-haspopup="menu"
              aria-expanded={menu === 'preset'}
              className={tabClass(view.mode === 'preset')}
              onClick={() => setMenu(menu === 'preset' ? null : 'preset')}
            >
              Presets{view.mode === 'preset' ? `: ${PRESET_LABELS[view.preset]}` : ''} ▾
            </button>
            {menu === 'preset' && (
              <div className={styles.menu} role="menu">
                {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
                  <button
                    key={p}
                    role="menuitemradio"
                    aria-checked={view.mode === 'preset' && view.preset === p}
                    className={view.mode === 'preset' && view.preset === p ? styles.checked : ''}
                    onClick={() => {
                      setPreset(p);
                      setMenu(null);
                    }}
                  >
                    {PRESET_LABELS[p]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.menuWrap}>
            <button
              role="tab"
              aria-selected={view.mode === 'isolate'}
              aria-haspopup="menu"
              aria-expanded={menu === 'isolate'}
              className={tabClass(view.mode === 'isolate')}
              onClick={() => setMenu(menu === 'isolate' ? null : 'isolate')}
            >
              Isolate{view.mode === 'isolate' ? `: ${PLANE_SHORT[isolatePlane]}` : ''} ▾
            </button>
            {menu === 'isolate' && (
              <div className={styles.menu} role="menu">
                {isolateChoices.map((p) => (
                  <button
                    key={p}
                    role="menuitemradio"
                    aria-checked={view.mode === 'isolate' && isolatePlane === p}
                    className={view.mode === 'isolate' && isolatePlane === p ? styles.checked : ''}
                    onClick={() => {
                      setIsolatePlane(p);
                      setMenu(null);
                    }}
                  >
                    {PLANE_SHORT[p]} plane
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Modes are independent toggles layered on any view, so they sit outside the view tablist. */}
        <div className={styles.menuWrap}>
          <button
            aria-haspopup="menu"
            aria-expanded={menu === 'modes'}
            className={tabClass(modesOn > 0)}
            onClick={() => setMenu(menu === 'modes' ? null : 'modes')}
          >
            Modes{modesOn > 0 ? ` (${modesOn})` : ''} ▾
          </button>
          {menu === 'modes' && (
            <div className={styles.menu} role="menu">
              {MODE_IDS.map((m) => (
                <button
                  key={m}
                  role="menuitemcheckbox"
                  aria-checked={modes[m]}
                  title={MODE_HINTS[m]}
                  className={`${styles.toggleItem} ${modes[m] ? styles.checked : ''}`}
                  onClick={() => toggleMode(m)}
                >
                  <span>{MODE_LABELS[m]}</span>
                  <span className={`${styles.switch} ${modes[m] ? styles.switchOn : ''}`} aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <SessionControls />
    </div>
  );
}

function SessionName() {
  const name = useSession((s) => s.name);
  const meta = useSession((s) => s.meta);
  const dirty = useSession((s) => s.dirty);
  const isOwner = useSession(selectIsOwner);
  const status = !meta ? 'Not saved' : `${meta.isPublic ? 'Public' : 'Private'}${isOwner ? '' : ` · by ${meta.ownerName}`}`;
  return (
    <div className={styles.session}>
      <input
        type="text"
        className={styles.sessionName}
        value={name}
        placeholder={DEFAULT_SESSION_NAME}
        maxLength={SESSION_NAME_MAX}
        onChange={(e) => renameSession(e.target.value)}
        aria-label="Session name"
      />
      <span className={styles.sessionStatus}>
        {status}
        {dirty && meta && <span className={styles.unsaved}> · unsaved changes</span>}
      </span>
    </div>
  );
}

function SessionControls() {
  const user = useSession((s) => s.user);
  const meta = useSession((s) => s.meta);
  const dirty = useSession((s) => s.dirty);
  const busy = useSession((s) => s.busy);
  const notice = useSession((s) => s.notice);
  const isOwner = useSession(selectIsOwner);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.kind === 'error' ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [accountOpen]);

  // Your own session saves in place; anything else (new, or someone else's) saves as your private copy.
  const saveLabel = !meta || isOwner ? 'Save' : 'Save a copy';
  const saveTitle = !meta
    ? 'Save to your sessions (private)'
    : isOwner
      ? 'Save changes to this session'
      : `Only ${meta.ownerName} can save this session; save your own private copy instead`;

  return (
    <div className={styles.io}>
      {notice && (
        <span
          className={`${styles.toast} ${notice.kind === 'error' ? styles.error : ''}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </span>
      )}
      <button onClick={() => openDialog('sessions')} title="Browse public and saved sessions">
        ☰ Sessions
      </button>
      <button onClick={() => openDialog('share')} title="Get a link to this session">
        🔗 Share
      </button>
      {user && (
        <button
          className={dirty || !isOwner ? 'primary' : ''}
          disabled={busy || (isOwner && !dirty)}
          onClick={() => void saveSession()}
          title={saveTitle}
        >
          💾 {saveLabel}
        </button>
      )}
      {user ? (
        <div className={styles.menuWrap} ref={accountRef}>
          <button
            className={styles.account}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            title={user.username}
            onClick={() => setAccountOpen(!accountOpen)}
          >
            <span className={styles.accountName}>{user.username}</span> ▾
          </button>
          {accountOpen && (
            <div className={`${styles.menu} ${styles.menuRight}`} role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  setAccountOpen(false);
                  openDialog('sessions');
                }}
              >
                My sessions
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setAccountOpen(false);
                  void logout();
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => openDialog('auth')}>Log in</button>
      )}
    </div>
  );
}
