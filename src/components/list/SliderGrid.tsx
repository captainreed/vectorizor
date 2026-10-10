import styles from './List.module.css';
import { useStore } from '../../state/store';
import { PLANE_IDS, STEP_MAX, STEP_MIN, type AnyAxisId, type DiagonalId, type LineItem } from '../../state/schema';
import { AXIS_COLORS, DIAGONAL_SHORT, PLANE_AXES } from '../../lib/coords';

const TICKS = Array.from({ length: STEP_MAX - STEP_MIN + 1 }, (_, i) => STEP_MIN + i);

/** Compass sliders, laid out as floor diagonals then up-diagonals. */
const DIAGONAL_ROWS: [DiagonalId, DiagonalId][] = [
  ['ne', 'nw'],
  ['une', 'unw'],
];

export default function SliderGrid({ item }: { item: LineItem }) {
  const compass = useStore((s) => s.modes.compass);
  const setPoint = useStore((s) => s.setPoint);
  const setDiagonal = useStore((s) => s.setDiagonal);

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
          {(['a', 'b'] as const).map((slot, i) => (
            <AxisSlider
              key={slot}
              axisId={PLANE_AXES[plane][i]}
              value={item.points[plane][slot]}
              color={item.color}
              label={(name) => `${plane.toUpperCase()} plane ${name}`}
              onChange={(v) => setPoint(item.id, plane, slot, v)}
            />
          ))}
        </div>
      ))}
      {compass && (
        <>
          <div className={styles.sliderSection}>Diagonals</div>
          {DIAGONAL_ROWS.map((row) => (
            <div key={row.join('-')} className={styles.planeRow}>
              <span className={styles.planeLabel} />
              {row.map((d) => (
                <AxisSlider
                  key={d}
                  axisId={d}
                  value={item.diagonals[d]}
                  color={item.color}
                  label={() => `Diagonal ${DIAGONAL_SHORT[d]}`}
                  onChange={(v) => setDiagonal(item.id, d, v)}
                />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function AxisSlider({
  axisId,
  value,
  color,
  label,
  onChange,
}: {
  axisId: AnyAxisId;
  value: number;
  color: string;
  /** Accessible label, given the axis's current (user-editable) name. */
  label: (axisName: string) => string;
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
        list="vz-ticks"
        value={value}
        aria-label={label(axis.name)}
        aria-valuetext={`${value}`}
        style={{ accentColor: color }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className={styles.ends}>
        <span>{axis.negLabel}</span>
        <span>{axis.posLabel}</span>
      </div>
    </div>
  );
}
