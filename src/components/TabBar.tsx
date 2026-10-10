import { useEffect, useRef, useState } from 'react';
import styles from './TabBar.module.css';
import { selectIsolatePlane, useStore } from '../state/store';
import {
  MODE_IDS,
  PRESETS,
  SESSION_NAME_MAX,
  type DiagonalPlaneId,
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
import { useIsMobile } from '../lib/useMediaQuery';

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

/** The plane each preset looks straight at (Isometric has none). */
const PRESET_PLANE: Record<Preset, IsolatePlane | null> = { front: 'xy', top: 'xz', side: 'yz', iso: null };

const COMPASS_PLANE_LABELS: Record<DiagonalPlaneId, string> = { 'ne-y': 'NE–Y plane', 'nw-y': 'NW–Y plane' };

type MenuId = 'views' | 'modes' | null;

export default function TabBar() {
  const view = useStore((s) => s.view);
  const toggleVectors = useStore((s) => s.toggleVectors);
  const setPreset = useStore((s) => s.setPreset);
  const setIsolatePlane = useStore((s) => s.setIsolatePlane);
  const modes = useStore((s) => s.modes);
  const toggleMode = useStore((s) => s.toggleMode);
  const modesOn = MODE_IDS.filter((m) => modes[m]).length;
  const isolatePlane = useStore(selectIsolatePlane);
  // Compass planes can be isolated while they're shown (some item uses one of their diagonals);
  // they have no preset, so their rows only offer Isolate.
  const items = useStore((s) => s.items);
  const viewRows: { label: string; preset?: Preset; plane: IsolatePlane | null }[] = [
    ...PRESETS.map((p) => ({ label: PRESET_LABELS[p], preset: p, plane: PRESET_PLANE[p] })),
    ...activeCompassPlanes(items).map((p) => ({ label: COMPASS_PLANE_LABELS[p], plane: p })),
  ];
  const [menu, setMenu] = useState<MenuId>(null);
  const barRef = useRef<HTMLDivElement>(null);
  // Phones: every control lives in one ☰ panel that opens over the page, with Views and Modes
  // listed inline instead of as dropdowns.
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const inDrawer = isMobile && drawerOpen;
  const dialog = useSession((s) => s.dialog);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  // Opening a dialog (Sessions, Share, Log in) from the panel closes the panel behind it.
  useEffect(() => {
    if (dialog) setDrawerOpen(false);
  }, [dialog]);

  useEffect(() => {
    if (!menu && !drawerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (barRef.current?.contains(e.target as Node)) return;
      setMenu(null);
      setDrawerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(null);
      setDrawerOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, drawerOpen]);

  const menuShown = (id: Exclude<MenuId, null>) => inDrawer || menu === id;
  const closeMenus = () => {
    setMenu(null);
    setDrawerOpen(false);
  };

  const tabClass = (active: boolean) => `${styles.tab} ${active ? styles.active : ''}`;

  return (
    <div className={styles.bar} ref={barRef}>
      <div className={styles.brand}>Vectorizor</div>
      <SessionName />
      <Notice />
      <button
        className={`${styles.burger} ${drawerOpen ? styles.burgerOpen : ''}`}
        aria-label="Menu"
        aria-expanded={drawerOpen}
        aria-controls="app-controls"
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        {drawerOpen ? '✕' : '☰'}
      </button>
      <div id="app-controls" className={`${styles.controls} ${drawerOpen ? styles.controlsOpen : ''}`}>
        <div className={styles.tabs}>
          {/* Dots-only vs arrows is independent of the camera, so it stays put when a View is picked. */}
          <button
            role="switch"
            aria-checked={view.vectors}
            aria-label="Vectors"
            title={view.vectors ? 'Showing vectors: switch to dots only (Free 3D)' : 'Showing dots only: switch to vectors'}
            className={`${styles.tab} ${styles.displayToggle}`}
            onClick={toggleVectors}
          >
            <span className={view.vectors ? '' : styles.toggleOn}>Free 3D</span>
            <span className={styles.toggleSep} aria-hidden>
              ⇄
            </span>
            <span className={view.vectors ? styles.toggleOn : ''}>Vectors</span>
          </button>

          <div className={styles.menuWrap}>
            {inDrawer ? (
              <div className={styles.drawerHeading}>Views</div>
            ) : (
              <button
                aria-haspopup="menu"
                aria-expanded={menu === 'views'}
                className={tabClass(view.mode === 'preset' || view.mode === 'isolate')}
                onClick={() => setMenu(menu === 'views' ? null : 'views')}
              >
                Views
                {view.mode === 'preset' ? `: ${PRESET_LABELS[view.preset]}` : ''}
                {view.mode === 'isolate' ? `: Isolate ${PLANE_SHORT[isolatePlane]}` : ''} ▾
              </button>
            )}
            {menuShown('views') && (
              // Two columns: the camera preset, and isolating that preset's plane.
              <div className={`${styles.menu} ${styles.viewsMenu}`} role="menu" aria-label="Views">
                {viewRows.map(({ label, preset, plane }) => {
                  const presetOn = !!preset && view.mode === 'preset' && view.preset === preset;
                  const planeOn = !!plane && view.mode === 'isolate' && isolatePlane === plane;
                  return (
                    <div key={label} className={styles.viewRow} role="group" aria-label={label}>
                      {preset ? (
                        <button
                          role="menuitemradio"
                          aria-checked={presetOn}
                          className={presetOn ? styles.checked : ''}
                          onClick={() => {
                            setPreset(preset);
                            closeMenus();
                          }}
                        >
                          {label}
                        </button>
                      ) : (
                        <span className={styles.viewLabel}>{label}</span>
                      )}
                      <span className={styles.viewDivider} aria-hidden>
                        {plane ? '|' : ''}
                      </span>
                      {plane ? (
                        <button
                          role="menuitemradio"
                          aria-checked={planeOn}
                          aria-label={`Isolate ${PLANE_SHORT[plane]} plane`}
                          className={planeOn ? styles.checked : ''}
                          onClick={() => {
                            setIsolatePlane(plane);
                            closeMenus();
                          }}
                        >
                          Isolate
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modes are independent toggles layered on any view, so they sit outside the view tablist. */}
          <div className={styles.menuWrap}>
            {inDrawer ? (
              <div className={styles.drawerHeading}>Modes</div>
            ) : (
              <button
                aria-haspopup="menu"
                aria-expanded={menu === 'modes'}
                className={tabClass(modesOn > 0)}
                onClick={() => setMenu(menu === 'modes' ? null : 'modes')}
              >
                Modes{modesOn > 0 ? ` (${modesOn})` : ''} ▾
              </button>
            )}
            {menuShown('modes') && (
              <div className={styles.menu} role="menu" aria-label="Modes">
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
        <SessionControls inDrawer={inDrawer} />
      </div>
    </div>
  );
}

/** Session messages ("Saved.", errors), floating under the bar; outside the ☰ panel so they show either way. */
function Notice() {
  const notice = useSession((s) => s.notice);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), notice.kind === 'error' ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;
  return (
    <span
      className={`${styles.toast} ${notice.kind === 'error' ? styles.error : ''}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      {notice.text}
    </span>
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

function SessionControls({ inDrawer }: { inDrawer: boolean }) {
  const user = useSession((s) => s.user);
  const meta = useSession((s) => s.meta);
  const dirty = useSession((s) => s.dirty);
  const busy = useSession((s) => s.busy);
  const isOwner = useSession(selectIsOwner);
  const [accountMenuOpen, setAccountOpen] = useState(false);
  // In the ☰ panel the account actions are simply listed.
  const accountOpen = accountMenuOpen || inDrawer;
  const accountRef = useRef<HTMLDivElement>(null);

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
          {inDrawer ? (
            <div className={styles.drawerHeading} title={user.username}>
              Signed in as <span className={styles.accountName}>{user.username}</span>
            </div>
          ) : (
          <button
            className={styles.account}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            title={user.username}
            onClick={() => setAccountOpen(!accountOpen)}
          >
            <span className={styles.accountName}>{user.username}</span> ▾
          </button>
          )}
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
