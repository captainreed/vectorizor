import { Line } from '@react-three/drei';
import { Quaternion, Vector3 } from 'three';
import { useStore } from '../../state/store';
import type { PlaneId } from '../../state/schema';
import { planePointTo3D, type Vec3 } from '../../lib/coords';
import { DOT_RADIUS } from './PointDots';

const HEAD_LEN = 0.42;
const HEAD_RADIUS = 0.13;
const UP = new Vector3(0, 1, 0);

/** Arrow from the origin to each of the item's points (one per displayed plane). */
export default function Vectors({ planes }: { planes: PlaneId[] }) {
  const items = useStore((s) => s.items);

  return (
    <group>
      {items
        .filter((i) => i.visible)
        .map((item) =>
          planes.map((plane) => {
            const tip = new Vector3(...planePointTo3D(plane, item.points[plane]));
            const len = tip.length();
            if (len < 1e-6) return null; // zero-length vector: just the dot at the origin
            const dir = tip.clone().normalize();
            // Shrink the head for very short vectors so it doesn't overshoot the origin.
            const head = Math.min(HEAD_LEN, len * 0.5);
            const headTipDist = len - DOT_RADIUS * 0.6;
            const headCenter = dir.clone().multiplyScalar(headTipDist - head / 2);
            const shaftEnd = dir.clone().multiplyScalar(headTipDist - head * 0.9);
            const quat = new Quaternion().setFromUnitVectors(UP, dir);
            return (
              <group key={`${item.id}-${plane}`}>
                <Line points={[[0, 0, 0], shaftEnd.toArray() as Vec3]} color={item.color} lineWidth={3} />
                <mesh position={headCenter} quaternion={quat} raycast={() => null}>
                  <coneGeometry args={[HEAD_RADIUS * (head / HEAD_LEN), head, 20]} />
                  <meshStandardMaterial color={item.color} roughness={0.5} />
                </mesh>
              </group>
            );
          }),
        )}
    </group>
  );
}
