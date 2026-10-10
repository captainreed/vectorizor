import { useEffect, useRef, useState } from 'react';
import styles from './Sessions.module.css';
import { getDocument } from '../../state/store';
import { documentSchema, exportFileSchema, toSessionFile, type AppDocument } from '../../state/schema';
import { DEFAULT_SESSION_NAME, importDocument, openDialog, useSession } from '../../state/session';

/** Import/Export of the working session as a JSON file, at the foot of the Sessions dialog. */
export default function ImportExport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ doc: AppDocument; name?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const onExport = () => {
    const name = useSession.getState().name.trim() || DEFAULT_SESSION_NAME;
    const blob = new Blob([JSON.stringify(toSessionFile(name, getDocument()), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'session';
    a.download = `vectorizor-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const onFile = async (file: File) => {
    try {
      const json = JSON.parse(await file.text());
      const wrapped = exportFileSchema.safeParse(json);
      const doc = wrapped.success ? wrapped.data.data : documentSchema.parse(json);
      setError(null);
      setPending({ doc, name: wrapped.success ? wrapped.data.name : undefined });
    } catch {
      setPending(null);
      setError('That file is not a valid Vectorizor export.');
    }
  };

  return (
    <div className={styles.io}>
      {pending ? (
        <span className={styles.confirm}>
          Replace current data with {pending.doc.items.length} item{pending.doc.items.length === 1 ? '' : 's'}?
          <button
            className="primary"
            onClick={() => {
              importDocument(pending.doc, pending.name);
              setPending(null);
              openDialog(null);
            }}
          >
            Replace
          </button>
          <button onClick={() => setPending(null)}>Cancel</button>
        </span>
      ) : (
        <>
          <span className={styles.ioLabel}>This session as a file:</span>
          <button onClick={() => fileRef.current?.click()} title="Load a session from a JSON file">
            ⬆ Import
          </button>
          <button onClick={onExport} title="Download this session as JSON">
            ⬇ Export
          </button>
        </>
      )}
      {error && (
        <span className={styles.formError} role="alert">
          {error}
        </span>
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
