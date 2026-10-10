import { encode } from 'uqr';
import styles from './Sessions.module.css';
import { openDialog, selectIsOwner, shareUrl, useSession } from '../../state/session';

/** Square QR code for `text`, drawn as one SVG path (with the standard light border). */
export function QrCode({ text, size = 168 }: { text: string; size?: number }) {
  const { data, size: cells } = encode(text, { border: 2, ecc: 'M' });
  let d = '';
  data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)));
  return (
    <svg
      viewBox={`0 0 ${cells} ${cells}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR code for ${text}`}
    >
      <rect width={cells} height={cells} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

/** localhost links only work on this machine, so a phone scanning them would get nowhere. */
function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname.startsWith('127.');
}

/** Floating card over the graph with a QR code for the open session's share link. */
export default function QrPanel() {
  const meta = useSession((s) => s.meta);
  const isOwner = useSession(selectIsOwner);

  let body;
  if (meta?.isPublic) {
    const url = shareUrl(meta.id);
    body = (
      <>
        <QrCode text={url} />
        <span className={styles.qrUrl}>{url}</span>
        {isLoopback(window.location.hostname) && (
          <span className={styles.qrWarning}>
            This link uses {window.location.hostname}, which other devices can't open. Visit the app through this
            computer's network address (e.g. http://192.168.x.x:{window.location.port || 80}) to get a scannable code.
          </span>
        )}
      </>
    );
  } else {
    body = (
      <>
        <span>
          {!meta
            ? 'Save this session and make it public to get a QR code.'
            : isOwner
              ? 'This session is private. Make it public to get a QR code.'
              : "This session is private, so it can't be shared."}
        </span>
        {(!meta || isOwner) && (
          <button onClick={() => openDialog('share')}>Share options…</button>
        )}
      </>
    );
  }

  return (
    <div className={styles.qrPanel} role="region" aria-label="Session QR code">
      {body}
    </div>
  );
}
