import { useRef, useState } from 'react';
import styles from './Graph.module.css';
import { useStore } from '../../state/store';
import {
  ALL_AXIS_IDS,
  AXIS_IDS,
  AXIS_LABEL_MAX,
  DEFAULT_AXES,
  DIAGONAL_IDS,
  type AnyAxisId,
  type AxisLabel,
  type Axes,
  type DiagonalId,
} from '../../state/schema';
import { AXIS_COLORS } from '../../lib/coords';

const FIELDS: { key: keyof AxisLabel; label: string }[] = [
  { key: 'name', label: 'Axis' },
  { key: 'negLabel', label: '− end' },
  { key: 'posLabel', label: '+ end' },
];

/** Semi-opaque overlay listing axis names and end labels; pencil enters edit mode. */
export default function AxisKey() {
  const axes = useStore((s) => s.axes);
  const editing = useStore((s) => s.ui.keyEditing);
  const setKeyEditing = useStore((s) => s.setKeyEditing);
  const setAxisLabel = useStore((s) => s.setAxisLabel);
  const setAxes = useStore((s) => s.setAxes);
  const items = useStore((s) => s.items);
  const gridOpacity = useStore((s) => s.view.gridOpacity);
  const setGridOpacity = useStore((s) => s.setGridOpacity);
  const [collapsed, setCollapsed] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const snapshot = useRef<Axes | null>(null);
  // X/Y/Z always; a diagonal appears once a visible item uses it, or all of them under "More".
  const inUse = (d: DiagonalId) => items.some((i) => i.visible && i.values[d] !== 0);
  const shownIds: AnyAxisId[] = [...AXIS_IDS, ...DIAGONAL_IDS.filter((d) => showMore || inUse(d))];
  const hiddenCount = ALL_AXIS_IDS.length - shownIds.length;

  if (collapsed) {
    return (
      <button className={styles.pill} onClick={() => setCollapsed(false)} aria-label="Show axis key">
        Key ▾
      </button>
    );
  }

  const startEdit = () => {
    snapshot.current = axes;
    setKeyEditing(true);
  };

  const done = () => {
    // Blank labels fall back to defaults.
    const cleaned = Object.fromEntries(
      ALL_AXIS_IDS.map((id) => [
        id,
        Object.fromEntries(FIELDS.map(({ key }) => [key, axes[id][key].trim() || DEFAULT_AXES[id][key]])),
      ]),
    ) as Axes;
    setAxes(cleaned);
    setKeyEditing(false);
  };

  const cancel = () => {
    if (snapshot.current) setAxes(snapshot.current);
    setKeyEditing(false);
  };

  return (
    <div
      className={styles.key}
      aria-label="Axis key"
      role="region"
      onKeyDown={(e) => {
        if (!editing) return;
        if (e.key === 'Enter') done();
        if (e.key === 'Escape') cancel();
      }}
    >
      <div className={styles.keyHead}>
        <span>Key</span>
        <input
          type="range"
          className={styles.gridOpacity}
          min={0}
          max={100}
          step={5}
          value={Math.round(gridOpacity * 100)}
          aria-label="Grid opacity"
          aria-valuetext={`${Math.round(gridOpacity * 100)}%`}
          title={`Grid opacity: ${Math.round(gridOpacity * 100)}%`}
          onChange={(e) => setGridOpacity(Number(e.target.value) / 100)}
        />
        {!editing && (
          <button className="icon" onClick={startEdit} title="Edit axis labels" aria-label="Edit axis labels">
            ✎
          </button>
        )}
        <button className="icon" onClick={() => setCollapsed(true)} title="Hide key" aria-label="Hide axis key">
          ▴
        </button>
      </div>
      <table className={styles.keyTable}>
        <thead>
          <tr>
            {FIELDS.map((f) => (
              <th key={f.key}>{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shownIds.map((id) => (
            <tr key={id}>
              {FIELDS.map(({ key }, col) => (
                <td key={key}>
                  {col === 0 && <span className={styles.chip} style={{ background: AXIS_COLORS[id] }} />}
                  {editing ? (
                    <input
                      type="text"
                      value={axes[id][key]}
                      maxLength={AXIS_LABEL_MAX}
                      aria-label={`${DEFAULT_AXES[id].name.toUpperCase()} axis ${key === 'name' ? 'name' : key === 'negLabel' ? 'negative end label' : 'positive end label'}`}
                      autoFocus={id === 'x' && col === 0}
                      onChange={(e) => setAxisLabel(id, { [key]: e.target.value })}
                    />
                  ) : col === 0 ? (
                    <strong>{axes[id][key]}</strong>
                  ) : (
                    axes[id][key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {(showMore || hiddenCount > 0) && (
        <button
          className={styles.keyMore}
          onClick={() => setShowMore(!showMore)}
          aria-expanded={showMore}
          title={showMore ? 'Hide unused diagonal axes' : 'Show all diagonal axes'}
        >
          {showMore ? 'Less ▴' : `More (${hiddenCount}) ▾`}
        </button>
      )}
      {editing && (
        <div className={styles.keyActions}>
          <button onClick={cancel}>Cancel</button>
          <button className="primary" onClick={done}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
