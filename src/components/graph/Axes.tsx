import { Html, Line } from '@react-three/drei';
import { useStore } from '../../state/store';
import type { AxisId } from '../../state/schema';
import { AXIS_COLORS, AXIS_DIR, gridExtent, type Vec3 } from '../../lib/coords';
import styles from './Graph.module.css';

const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];

/** Bold axis lines through the origin, with end labels from the axis key. */
export default function Axes({ axes, gap, steps }: { axes: AxisId[]; gap: number; steps: number }) {
  const labels = useStore((s) => s.axes);
  const extent = gridExtent(gap, steps) + 0.6;
  const labelAt = gridExtent(gap, steps) + 1.3;

  return (
    <group>
      {axes.map((id) => {
        const dir = AXIS_DIR[id];
        const color = AXIS_COLORS[id];
        const label = labels[id];
        return (
          <group key={id}>
            <Line points={[scale(dir, -extent), scale(dir, extent)]} color={color} lineWidth={2.4} />
            <Html position={scale(dir, labelAt)} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
              <div className={styles.axisLabel} style={{ color }}>
                <strong>{label.name}</strong>
                <span>{label.posLabel}</span>
              </div>
            </Html>
            <Html position={scale(dir, -labelAt)} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
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
