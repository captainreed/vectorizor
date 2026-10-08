import { Html, Line } from '@react-three/drei';
import { useStore } from '../../state/store';
import { STEP_MAX, type AxisId } from '../../state/schema';
import { AXIS_COLORS, AXIS_DIR, type Vec3 } from '../../lib/coords';
import styles from './Graph.module.css';

const EXTENT = STEP_MAX + 0.6;
const LABEL_AT = STEP_MAX + 1.3;

const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];

/** Bold axis lines through the origin, with end labels from the axis key. */
export default function Axes({ axes }: { axes: AxisId[] }) {
  const labels = useStore((s) => s.axes);

  return (
    <group>
      {axes.map((id) => {
        const dir = AXIS_DIR[id];
        const color = AXIS_COLORS[id];
        const label = labels[id];
        return (
          <group key={id}>
            <Line points={[scale(dir, -EXTENT), scale(dir, EXTENT)]} color={color} lineWidth={2.4} />
            <Html position={scale(dir, LABEL_AT)} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className={styles.axisLabel} style={{ color }}>
                <strong>{label.name}</strong>
                <span>{label.posLabel}</span>
              </div>
            </Html>
            <Html position={scale(dir, -LABEL_AT)} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className={styles.axisLabel} style={{ color }}>
                <span>{label.negLabel}</span>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
