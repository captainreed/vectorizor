import { useEffect, useRef, useState } from 'react';
import styles from './List.module.css';
import { useStore } from '../../state/store';
import { AXIS_IDS, DESCRIPTION_MAX, DIAGONAL_IDS, NAME_MAX, type LineItem } from '../../state/schema';
import { formatCoords, resultant } from '../../lib/coords';
import SliderGrid from './SliderGrid';

interface Props {
  item: LineItem;
  expanded: boolean;
  selected: boolean;
  autoFocus?: boolean;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function LineItemRow({ item, expanded, selected, autoFocus }: Props) {
  const toggleVisible = useStore((s) => s.toggleVisible);
  const setExpanded = useStore((s) => s.setExpanded);
  const updateItem = useStore((s) => s.updateItem);
  const deleteItem = useStore((s) => s.deleteItem);
  const single = useStore((s) => s.modes.single);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hexDraft, setHexDraft] = useState(item.color);
  const rowRef = useRef<HTMLLIElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHexDraft(item.color), [item.color]);

  useEffect(() => {
    if (expanded) rowRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [expanded]);

  useEffect(() => {
    if (expanded && autoFocus) nameRef.current?.focus();
  }, [expanded, autoFocus]);

  const commitHex = () => {
    const v = hexDraft.startsWith('#') ? hexDraft : `#${hexDraft}`;
    if (HEX_RE.test(v)) updateItem(item.id, { color: v.toLowerCase() });
    else setHexDraft(item.color);
  };

  const toggleExpand = () => setExpanded(expanded ? null : item.id);

  const rowClass = [styles.row, expanded && styles.expanded, selected && styles.selected]
    .filter(Boolean)
    .join(' ');

  return (
    <li ref={rowRef} className={rowClass} style={{ '--item-color': item.color } as React.CSSProperties}>
      <div
        className={styles.header}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${item.name || 'Untitled'} — ${expanded ? 'collapse' : 'expand to edit'}`}
        onClick={toggleExpand}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpand();
          }
        }}
      >
        <input
          type="checkbox"
          className={styles.check}
          checked={item.visible}
          aria-label={`Show ${item.name || 'item'} on graph`}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleVisible(item.id)}
        />
        <span className={styles.chevron} aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
        <span className={styles.swatch} style={{ background: item.color }} aria-hidden />
        <span className={styles.name}>{item.name || <em>Untitled</em>}</span>
        {!expanded && (
          <span className={styles.summary}>
            <span>XYZ{formatCoords(AXIS_IDS.map((a) => item.values[a]))}</span>
            {DIAGONAL_IDS.some((d) => item.values[d] !== 0) && (
              <span>Diag{formatCoords(DIAGONAL_IDS.map((d) => item.values[d]))}</span>
            )}
            {single && <span className={styles.resultant}>Sum{formatCoords(resultant(item))}</span>}
          </span>
        )}
        <span className={styles.spacer} />
        {confirmDelete ? (
          <span className={styles.confirm} onClick={(e) => e.stopPropagation()}>
            Delete?
            <button className="danger" onClick={() => deleteItem(item.id)}>
              Yes
            </button>
            <button onClick={() => setConfirmDelete(false)}>No</button>
          </span>
        ) : (
          <button
            className="icon"
            title="Delete item"
            aria-label={`Delete ${item.name || 'item'}`}
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
          >
            🗑
          </button>
        )}
      </div>

      {expanded && (
        <div className={styles.editor}>
          <div className={styles.fields}>
            <div className={styles.inlineFields}>
              <label className={styles.field}>
                <span>Color</span>
                <span className={styles.colorRow}>
                  <input
                    type="color"
                    value={item.color}
                    aria-label="Color picker"
                    onChange={(e) => updateItem(item.id, { color: e.target.value })}
                  />
                  <input
                    type="text"
                    value={hexDraft}
                    aria-label="Color hex value"
                    maxLength={7}
                    className={styles.hex}
                    onChange={(e) => setHexDraft(e.target.value)}
                    onBlur={commitHex}
                    onKeyDown={(e) => e.key === 'Enter' && commitHex()}
                  />
                </span>
              </label>
              <label className={`${styles.field} ${styles.grow}`}>
                <span>Name</span>
                <input
                  ref={nameRef}
                  type="text"
                  value={item.name}
                  maxLength={NAME_MAX}
                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Description</span>
              <textarea
                value={item.description}
                maxLength={DESCRIPTION_MAX}
                rows={2}
                onChange={(e) => updateItem(item.id, { description: e.target.value })}
              />
            </label>
            <div className={styles.collapseRow}>
              <button onClick={() => setExpanded(null)}>Collapse</button>
            </div>
          </div>
          <SliderGrid item={item} />
        </div>
      )}
    </li>
  );
}
