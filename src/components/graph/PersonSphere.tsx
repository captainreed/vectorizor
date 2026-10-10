import { Billboard } from '@react-three/drei';
import type { Vec3 } from '../../lib/coords';

const SPHERE_COLOR = '#7c6ef0';
const ICON_COLOR = '#3d4459';

/**
 * Translucent sphere with a camera-facing person icon at its center. Everything is drawn relative
 * to `position`, so moving the person is just a matter of passing a different position.
 */
export default function PersonSphere({ position, radius }: { position: Vec3; radius: number }) {
  return (
    <group position={position}>
      {/* raycast disabled so the sphere never blocks hovering/clicking points inside or behind it */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshStandardMaterial color={SPHERE_COLOR} transparent opacity={0.16} roughness={0.3} depthWrite={false} />
      </mesh>
      <Billboard>
        <group scale={radius}>
          {/* head */}
          <mesh position={[0, 0.24, 0]} raycast={() => null} renderOrder={1}>
            <circleGeometry args={[0.2, 32]} />
            <meshBasicMaterial color={ICON_COLOR} transparent opacity={0.85} depthWrite={false} />
          </mesh>
          {/* shoulders: upper half-disc */}
          <mesh position={[0, -0.42, 0]} raycast={() => null} renderOrder={1}>
            <circleGeometry args={[0.38, 32, 0, Math.PI]} />
            <meshBasicMaterial color={ICON_COLOR} transparent opacity={0.85} depthWrite={false} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}
