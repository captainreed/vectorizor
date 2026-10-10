import { useMemo } from 'react';
import { DoubleSide } from 'three';
import { Line } from '@react-three/drei';
import { useStore } from '../../state/store';
import type { IsolatePlane } from '../../state/schema';
import { PLANE_TINTS, planePointTo3D, type Vec3 } from '../../lib/coords';

/**
 * One finite grid plane spanning ±`steps` around the origin, built from the plane's two axis
 * directions (so it works for the 45° Compass planes too). `gap` widens the space around the
 * origin; large grids draw a line every `lineEvery` steps.
 */
export default function GridPlane({ plane, gap, steps }: { plane: IsolatePlane; gap: number; steps: number }) {
  const at = (a: number, b: number): Vec3 => planePointTo3D(plane, { a, b }, gap);
  const lineEvery = steps > 10 ? 5 : 1;
  const min = -steps;
  const max = steps;

  const gridPositions = useMemo(() => {
    const pts: number[] = [];
    for (let i = min + lineEvery; i < max; i += lineEvery) {
      if (i === 0) continue; // axis lines are drawn separately
      pts.push(...at(i, min), ...at(i, max));
      pts.push(...at(min, i), ...at(max, i));
    }
    return new Float32Array(pts);
  }, [plane, gap, steps]);

  const corners = [at(min, min), at(max, min), at(max, max), at(min, max)];
  // Two triangles covering the plane, for the faint tinted fill.
  const fill = useMemo(
    () => new Float32Array([...corners[0], ...corners[1], ...corners[2], ...corners[0], ...corners[2], ...corners[3]]),
    [plane, gap, steps],
  );

  const tint = PLANE_TINTS[plane];
  // User-controlled multiplier from the key's slider; axes are drawn separately and stay visible.
  const k = useStore((s) => s.view.gridOpacity);

  return (
    <group visible={k > 0}>
      {/* Keyed on size so geometries (and their bounding spheres) are rebuilt when the grid resizes. */}
      <mesh key={`fill-${gap}-${steps}`} renderOrder={-1}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fill, 3]} />
        </bufferGeometry>
        <meshBasicMaterial color={tint} transparent opacity={0.05 * k} side={DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments key={`lines-${gap}-${steps}`}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[gridPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#9aa3b5" transparent opacity={0.45 * k} />
      </lineSegments>
      <Line points={[...corners, corners[0]]} color={tint} lineWidth={1.6} transparent opacity={0.55 * k} />
    </group>
  );
}
