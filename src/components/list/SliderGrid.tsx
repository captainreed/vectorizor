import styles from './List.module.css';
import { useStore } from '../../state/store';
import { PLANE_IDS, STEP_MAX, STEP_MIN, type AxisId, type LineItem, type PlaneId } from '../../state/schema';
import { AXIS_COLORS, PLANE_AXES } from '../../lib/coords';

const TICKS = Array.from({ length: STEP_MAX - STEP_MIN + 1 }, (_, i) => STEP_MIN + i);

export default function SliderGrid({ item }: { item: LineItem }) {
  return (
    <div className={styles.sliders} aria-label="Point position sliders">
      <datalist id="vz-ticks">
        {TICKS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      {PLANE_IDS.map((plane) => (
        <div key={plane} className={styles.planeRow}>
          <span className={styles.planeLabel}>{plane.toUpperCase()}</span>
          <AxisSlider item={item} plane={plane} slot="a" />
          <AxisSlider item={item} plane={plane} slot="b" />
        </div>
      ))}
    </div>
  );
}

function AxisSlider({ item, plane, slot }: { item: LineItem; plane: PlaneId; slot: 'a' | 'b' }) {
  const axisId: AxisId = PLANE_AXES[plane][slot === 'a' ? 0 : 1];
  const axis = useStore((s) => s.axes[axisId]);
  const setPoint = useStore((s) => s.setPoint);
  const value = item.points[plane][slot];

  return (
    <div className={styles.slider}>
      <div className={styles.sliderHead}>
        <span className={styles.axisChip} style={{ background: AXIS_COLORS[axisId] }} />
        <span className={styles.axisName}>{axis.name}</span>
        <output className={styles.value}>{value}</output>
      </div>
      <input
        type="range"
        min={STEP_MIN}
        max={STEP_MAX}
        step={1}
        list="vz-ticks"
        value={value}
        aria-label={`${plane.toUpperCase()} plane ${axis.name}`}
        aria-valuetext={`${value}`}
        style={{ accentColor: item.color }}
        onChange={(e) => setPoint(item.id, plane, slot, Number(e.target.value))}
      />
      <div className={styles.ends}>
        <span>{axis.negLabel}</span>
        <span>{axis.posLabel}</span>
      </div>
    </div>
  );
}
