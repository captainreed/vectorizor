import { useState } from 'react';
import styles from './List.module.css';
import { useStore } from '../../state/store';
import LineItemRow from './LineItemRow';

export default function ListSection() {
  const items = useStore((s) => s.items);
  const expandedId = useStore((s) => s.ui.expandedId);
  const selectedId = useStore((s) => s.ui.selectedId);
  const addItem = useStore((s) => s.addItem);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  return (
    <>
      <div className={styles.toolbar}>
        <button className="primary" onClick={() => setJustAddedId(addItem())}>
          + Add new item
        </button>
        <span className={styles.count}>
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className={styles.list} aria-label="Line items">
        {items.length === 0 && (
          <li className={styles.empty}>No items yet. Click “Add new item” to create your first point set.</li>
        )}
        {items.map((item) => (
          <LineItemRow
            key={item.id}
            item={item}
            expanded={item.id === expandedId}
            selected={item.id === selectedId}
            autoFocus={item.id === justAddedId}
          />
        ))}
      </ul>
    </>
  );
}
