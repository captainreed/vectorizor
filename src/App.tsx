import { useState } from 'react';
import styles from './App.module.css';
import TabBar from './components/TabBar';
import GraphCanvas from './components/graph/GraphCanvas';
import AxisKey from './components/graph/AxisKey';
import ListSection from './components/list/ListSection';
import AuthDialog from './components/sessions/AuthDialog';
import SessionsDialog from './components/sessions/SessionsDialog';
import ShareDialog from './components/sessions/ShareDialog';
import QrPanel from './components/sessions/QrPanel';
import { useStore } from './state/store';
import { useSession } from './state/session';

export default function App() {
  const resetCamera = useStore((s) => s.resetCamera);
  const dialog = useSession((s) => s.dialog);
  const [qrOpen, setQrOpen] = useState(false);
  return (
    <div className={styles.app}>
      <header className={styles.tabs}>
        <TabBar />
      </header>
      <main className={styles.graph}>
        <GraphCanvas />
        {/* Key, with the QR card (when shown) stacked underneath at the same width. */}
        <div className={styles.overlays}>
          <AxisKey />
          {qrOpen && <QrPanel />}
        </div>
        <div className={styles.viewButtons}>
          <button onClick={resetCamera} title="Reset camera">
            ⟲ Reset view
          </button>
          <button
            className={qrOpen ? styles.on : ''}
            aria-pressed={qrOpen}
            onClick={() => setQrOpen(!qrOpen)}
            title={qrOpen ? 'Hide the QR code' : "Show a QR code for this session's link"}
          >
            QR
          </button>
        </div>
      </main>
      <section className={styles.list}>
        <ListSection />
      </section>
      {dialog === 'sessions' && <SessionsDialog />}
      {dialog === 'auth' && <AuthDialog />}
      {dialog === 'share' && <ShareDialog />}
    </div>
  );
}
