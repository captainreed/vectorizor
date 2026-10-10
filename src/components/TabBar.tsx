import { useEffect, useRef, useState } from 'react';
import styles from './TabBar.module.css';
import { getDocument, selectIsolatePlane, useStore } from '../state/store';
import {
  EXPORT_VERSION,
  MODE_IDS,
  PLANE_IDS,
  documentSchema,
  exportFileSchema,
  type AppDocument,
  type IsolatePlane,
  type ModeId,
  type Preset,
} from '../state/schema';
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
      <ImportExport />
    </div>
  );
}

function ImportExport() {
  const replaceDocument = useStore((s) => s.replaceDocument);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const onExport = () => {
    const payload = { app: 'vectorizor', version: EXPORT_VERSION, data: getDocument() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vectorizor-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const wrapped = exportFileSchema.safeParse(json);
      const doc = wrapped.success ? wrapped.data.data : documentSchema.parse(json);
      setError(null);
      setPending(doc);
    } catch {
      setPending(null);
      setError('That file is not a valid Vectorizor export.');
    }
  };

  return (
    <div className={styles.io}>
      {error && <span className={styles.error} role="alert">{error}</span>}
      {pending ? (
        <span className={styles.confirm}>
          Replace current data with {pending.items.length} item{pending.items.length === 1 ? '' : 's'}?
          <button
            className="primary"
            onClick={() => {
              replaceDocument(pending);
              setPending(null);
            }}
          >
            Replace
          </button>
          <button onClick={() => setPending(null)}>Cancel</button>
        </span>
      ) : (
        <>
          <button onClick={() => fileRef.current?.click()} title="Load data from a JSON file">
            ⬆ Import
          </button>
          <button onClick={onExport} title="Download data as JSON">
            ⬇ Export
          </button>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Import JSON file"
        data-testid="import-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
