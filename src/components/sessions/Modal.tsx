import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Sessions.module.css';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** Centered dialog over a dimmed backdrop; Escape or a backdrop click closes it. */
export default function Modal({ title, onClose, children, wide }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass a fresh onClose each render; reading it through a ref keeps the effect below
  // mount-only, so it doesn't re-run (and steal focus back to the first field) on every keystroke.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const restore = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>('input, button:not([data-close])');
    (first ?? panelRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      restore?.focus?.();
    };
  }, []);

  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className={`${styles.panel} ${wide ? styles.wide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button className="icon" data-close onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
