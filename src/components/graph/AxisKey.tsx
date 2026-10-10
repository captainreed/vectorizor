import { useRef, useState } from 'react';
import styles from './Graph.module.css';
import { useStore } from '../../state/store';
import { ALL_AXIS_IDS, AXIS_IDS, AXIS_LABEL_MAX, DEFAULT_AXES, type AxisLabel, type Axes } from '../../state/schema';
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
  const compass = useStore((s) => s.modes.compass);
  const [collapsed, setCollapsed] = useState(false);
  const snapshot = useRef<Axes | null>(null);
  const shownIds = compass ? ALL_AXIS_IDS : AXIS_IDS;

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
    // Blank labels fall back to defaults (hidden Compass labels are kept as-is).
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
