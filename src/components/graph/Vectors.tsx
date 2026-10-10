import { Line } from '@react-three/drei';
import { Quaternion, Vector3 } from 'three';
import { useStore } from '../../state/store';
import { itemMarkers, outwardArrow, pushArrow, type MarkerOptions, type Sphere, type Vec3 } from '../../lib/coords';

const HEAD_LEN = 0.42;
const HEAD_RADIUS = 0.13;
const UP = new Vector3(0, 1, 0);

/**
 * One arrow per item marker: per axis value, or a single 3D resultant in Single mode.
 * - Default: from the origin to the marker's point; with the person `sphere` shown, the tail starts
 *   on the sphere's surface instead (pointing away from its center).
 * - Push: the same vector slid back along its own direction until its tip touches the outside of
 *   the sphere, so it reads as a force of that magnitude pushing on the sphere. The length is the
 *   raw slider magnitude (unaffected by the Person-mode gap).
 */
export default function Vectors({
  options,
  sphere,
  push,
}: {
  options: MarkerOptions;
  sphere: Sphere | null;
  push: boolean;
}) {
  const items = useStore((s) => s.items);

  return (
    <group>
      {items
        .filter((i) => i.visible)
        .map((item) =>
          itemMarkers(item, options).map((marker) => {
            const key = `${item.id}-${marker.id}`;
            if (push && sphere) {
              const arrow = pushArrow(marker.steps, sphere.center, sphere.radius);
              if (!arrow) return null; // no force
              return (
                <Arrow key={key} tail={new Vector3(...arrow.tail)} tip={new Vector3(...arrow.tip)} color={item.color} />
              );
            }
            // Dots aren't drawn alongside arrows, so the tip lands right on the point.
            const arrow = outwardArrow(marker.world, sphere);
            if (!arrow) return null;
            return (
              <Arrow key={key} tail={new Vector3(...arrow.tail)} tip={new Vector3(...arrow.tip)} color={item.color} />
            );
          }),
        )}
    </group>
  );
}

/** Shaft + cone head whose point lands exactly on `tip`. */
function Arrow({ tail, tip, color }: { tail: Vector3; tip: Vector3; color: string }) {
  const span = tip.clone().sub(tail);
  const len = span.length();
  if (len < 1e-6) return null;
  const dir = span.normalize();
  // Shrink the head for very short arrows so it doesn't overshoot the tail.
  const head = Math.min(HEAD_LEN, len * 0.5);
  const headCenter = tip.clone().addScaledVector(dir, -head / 2);
  const shaftEnd = tip.clone().addScaledVector(dir, -head * 0.9);
  const quat = new Quaternion().setFromUnitVectors(UP, dir);
  return (
    <group>
      <Line points={[tail.toArray() as Vec3, shaftEnd.toArray() as Vec3]} color={color} lineWidth={3} />
      <mesh position={headCenter} quaternion={quat} raycast={() => null}>
        <coneGeometry args={[HEAD_RADIUS * (head / HEAD_LEN), head, 20]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}
