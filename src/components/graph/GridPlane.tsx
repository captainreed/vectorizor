import { useMemo } from 'react';
import { DoubleSide, Euler } from 'three';
import { Line } from '@react-three/drei';
import type { PlaneId } from '../../state/schema';
import { PLANE_TINTS, gridExtent, planePointTo3D, type Vec3 } from '../../lib/coords';

const ROTATION: Record<PlaneId, Euler> = {
  xy: new Euler(0, 0, 0),
  xz: new Euler(-Math.PI / 2, 0, 0),
  yz: new Euler(0, Math.PI / 2, 0),
};

/** One finite grid plane spanning ±`steps` around the origin; `gap` widens the space around the origin. */
export default function GridPlane({ plane, gap, steps }: { plane: PlaneId; gap: number; steps: number }) {
  const at = (a: number, b: number): Vec3 => planePointTo3D(plane, { a, b }, gap);
  const size = gridExtent(gap, steps) * 2;
  const min = -steps;
  const max = steps;

  const gridPositions = useMemo(() => {
    const pts: number[] = [];
    for (let i = min + 1; i < max; i++) {
      if (i === 0) continue; // axis lines are drawn separately
      pts.push(...at(i, min), ...at(i, max));
      pts.push(...at(min, i), ...at(max, i));
    }
    return new Float32Array(pts);
  }, [plane, gap, steps]);

  const border: Vec3[] = [
    at(min, min),
    at(max, min),
    at(max, max),
    at(min, max),
    at(min, min),
  ];

  const tint = PLANE_TINTS[plane];

  return (
    <group>
      <mesh rotation={ROTATION[plane]} renderOrder={-1}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color={tint} transparent opacity={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>
      {/* Keyed on size so the geometry (and its bounding sphere) is rebuilt when the grid resizes. */}
      <lineSegments key={`${gap}-${steps}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[gridPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#9aa3b5" transparent opacity={0.45} />
      </lineSegments>
      <Line points={border} color={tint} lineWidth={1.6} transparent opacity={0.55} />
    </group>
  );
}
