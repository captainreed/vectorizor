import styles from './List.module.css';
import { useStore } from '../../state/store';
import { AXIS_IDS, DIAGONAL_IDS, STEP_MAX, STEP_MIN, type AnyAxisId, type LineItem } from '../../state/schema';
import { AXIS_COLORS, AXIS_SHORT } from '../../lib/coords';

const TICKS = Array.from({ length: STEP_MAX - STEP_MIN + 1 }, (_, i) => STEP_MIN + i);

const SECTIONS: { title: string; axes: readonly AnyAxisId[] }[] = [
  { title: 'Axes', axes: AXIS_IDS },
  { title: 'Diagonals', axes: DIAGONAL_IDS },
];

/** One slider per axis (7 in all), each −5..5 and centered at 0 by default. */
export default function SliderGrid({ item }: { item: LineItem }) {
  const setValue = useStore((s) => s.setValue);

  return (
    <div className={styles.sliders} aria-label="Axis value sliders">
      {SECTIONS.map(({ title, axes }) => (
        <div key={title}>
          <div className={styles.sliderSection}>{title}</div>
          <div className={styles.axisGrid}>
            {axes.map((axis) => (
              <AxisSlider
                key={axis}
                axisId={axis}
                value={item.values[axis]}
                color={item.color}
                onChange={(v) => setValue(item.id, axis, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AxisSlider({
  axisId,
  value,
  color,
  onChange,
}: {
  axisId: AnyAxisId;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) {
  const axis = useStore((s) => s.axes[axisId]);

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
        value={value}
        // Fixed name (not the editable label) so it stays stable when axes are renamed.
        aria-label={`${AXIS_SHORT[axisId]} slider`}
        aria-valuetext={`${value}`}
        style={{ accentColor: color }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {/* Custom ticks (native datalist ticks can't be styled): zero is longer and darker. */}
      <div className={styles.ticks} aria-hidden>
        {TICKS.map((t) => (
          <span key={t} className={t === 0 ? styles.tickZero : styles.tick} />
        ))}
      </div>
      <div className={styles.ends}>
        <span>{axis.negLabel}</span>
        <span>{axis.posLabel}</span>
      </div>
    </div>
  );
}
