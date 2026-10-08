import { useMemo } from 'react';
import { DoubleSide, Euler } from 'three';
import { Line } from '@react-three/drei';
import { STEP_MAX, STEP_MIN, type PlaneId } from '../../state/schema';
import { PLANE_TINTS, planePointTo3D, type Vec3 } from '../../lib/coords';

const ROTATION: Record<PlaneId, Euler> = {
  xy: new Euler(0, 0, 0),
  xz: new Euler(-Math.PI / 2, 0, 0),
  yz: new Euler(0, Math.PI / 2, 0),
};

const SIZE = STEP_MAX - STEP_MIN;

/** One finite 10×10 grid plane centered on the origin. */
export default function GridPlane({ plane }: { plane: PlaneId }) {
  const at = (a: number, b: number): Vec3 => planePointTo3D(plane, { a, b });

  const gridPositions = useMemo(() => {
    const pts: number[] = [];
    for (let i = STEP_MIN + 1; i < STEP_MAX; i++) {
      if (i === 0) continue; // axis lines are drawn separately
      pts.push(...at(i, STEP_MIN), ...at(i, STEP_MAX));
      pts.push(...at(STEP_MIN, i), ...at(STEP_MAX, i));
    }
    return new Float32Array(pts);
  }, [plane]);

  const border: Vec3[] = [
    at(STEP_MIN, STEP_MIN),
    at(STEP_MAX, STEP_MIN),
    at(STEP_MAX, STEP_MAX),
    at(STEP_MIN, STEP_MAX),
    at(STEP_MIN, STEP_MIN),
  ];

  const tint = PLANE_TINTS[plane];

  return (
    <group>
      <mesh rotation={ROTATION[plane]} renderOrder={-1}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial color={tint} transparent opacity={0.05} side={DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[gridPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#9aa3b5" transparent opacity={0.45} />
      </lineSegments>
      <Line points={border} color={tint} lineWidth={1.6} transparent opacity={0.55} />
    </group>
  );
}
