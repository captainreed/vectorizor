import { useRef, useState } from 'react';
import Modal from './Modal';
import styles from './Sessions.module.css';
import { openDialog, saveSession, selectIsOwner, setSessionPublic, shareUrl, useSession } from '../../state/session';

/** navigator.clipboard only exists on https/localhost; on a plain-http LAN address fall back to execCommand. */
async function copyText(text: string, input: HTMLInputElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  input?.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

export default function ShareDialog() {
  const meta = useSession((s) => s.meta);
  const user = useSession((s) => s.user);
  const dirty = useSession((s) => s.dirty);
  const busy = useSession((s) => s.busy);
  const isOwner = useSession(selectIsOwner);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<boolean | null>(null);
  const close = () => openDialog(null);

  let body;
  if (!meta) {
    body = user ? (
      <>
        <p>Save this session first to get a link you can share.</p>
        <div className={styles.actions}>
          <button className="primary" disabled={busy} onClick={() => void saveSession()}>
            Save session
          </button>
        </div>
      </>
    ) : (
      <>
        <p>To share a session, log in and save it. Shared links open without an account.</p>
        <div className={styles.actions}>
          <button className="primary" onClick={() => openDialog('auth')}>
            Log in
          </button>
        </div>
      </>
    );
  } else if (!meta.isPublic) {
    body = isOwner ? (
      <>
        <p>
          This session is <strong>private</strong>. Make it public so anyone with the link can view it and it appears in
          the Sessions list.
        </p>
        <div className={styles.actions}>
          <button className="primary" disabled={busy} onClick={() => void setSessionPublic(meta.id, true)}>
            Make public
          </button>
        </div>
      </>
    ) : (
      <p>This session is private to its owner and can't be shared.</p>
    );
  } else {
    const url = shareUrl(meta.id);
    body = (
      <>
        <p>Anyone with this link can open the session and try changes, but only {isOwner ? 'you' : meta.ownerName} can save over it.</p>
        <div className={styles.copyRow}>
          <input ref={inputRef} type="text" readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} />
          <button className="primary" onClick={async () => setCopied(await copyText(url, inputRef.current))}>
            Copy link
          </button>
        </div>
        {copied !== null && (
          <p className={styles.hint} role="status">
            {copied ? 'Link copied.' : 'Copy failed. Select the link and copy it manually.'}
          </p>
        )}
        {dirty && isOwner && <p className={styles.hint}>You have unsaved changes; the link shows the last saved version.</p>}
        {isOwner && (
          <div className={styles.actions}>
            <button disabled={busy} onClick={() => void setSessionPublic(meta.id, false)}>
              Make private
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <Modal title="Share session" onClose={close}>
      <div className={styles.body}>{body}</div>
    </Modal>
  );
}
