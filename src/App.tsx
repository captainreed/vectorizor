import styles from './App.module.css';
import TabBar from './components/TabBar';
import GraphCanvas from './components/graph/GraphCanvas';
import AxisKey from './components/graph/AxisKey';
import ListSection from './components/list/ListSection';
import { useStore } from './state/store';

export default function App() {
  const resetCamera = useStore((s) => s.resetCamera);
  return (
    <div className={styles.app}>
      <header className={styles.tabs}>
        <TabBar />
      </header>
      <main className={styles.graph}>
        <GraphCanvas />
        <AxisKey />
        <button className={styles.reset} onClick={resetCamera} title="Reset camera">
          ⟲ Reset view
        </button>
      </main>
      <section className={styles.list}>
        <ListSection />
      </section>
    </div>
  );
}
