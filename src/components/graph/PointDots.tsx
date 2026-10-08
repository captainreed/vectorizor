import { useEffect, useState } from 'react';
import { Billboard, Html } from '@react-three/drei';
import { DoubleSide } from 'three';
import { useStore } from '../../state/store';
import type { PlaneId } from '../../state/schema';
import { formatPoint, planePointTo3D } from '../../lib/coords';
import styles from './Graph.module.css';

export const DOT_RADIUS = 0.18;

interface Hover {
  itemId: string;
  plane: PlaneId;
}

/** Colored spheres for each visible item's point on each displayed plane. */
export default function PointDots({ planes }: { planes: PlaneId[] }) {
  const items = useStore((s) => s.items);
  const selectedId = useStore((s) => s.ui.selectedId);
  const select = useStore((s) => s.select);
  const [hover, setHover] = useState<Hover | null>(null);

  const visible = items.filter((i) => i.visible);

  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover]);

  // Drop a stale hover if the item disappears.
  const hoverItem = hover && visible.find((i) => i.id === hover.itemId && planes.includes(hover.plane));

  let tooltip: { position: [number, number, number]; lines: { name: string; color: string }[]; coords: string } | null =
    null;
  if (hover && hoverItem) {
    const p = hoverItem.points[hover.plane];
    const sameSpot = visible.filter((i) => i.points[hover.plane].a === p.a && i.points[hover.plane].b === p.b);
    tooltip = {
      position: planePointTo3D(hover.plane, p),
      lines: sameSpot.map((i) => ({ name: i.name || 'Untitled', color: i.color })),
      coords: `${hover.plane.toUpperCase()} ${formatPoint(p)}`,
    };
  }

  return (
    <group>
      {visible.map((item) =>
        planes.map((plane) => {
          const pos = planePointTo3D(plane, item.points[plane]);
          const isSelected = item.id === selectedId;
          return (
            <group key={`${item.id}-${plane}`} position={pos}>
              <mesh
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHover({ itemId: item.id, plane });
                }}
                onPointerOut={() => setHover((h) => (h?.itemId === item.id && h.plane === plane ? null : h))}
                onClick={(e) => {
                  e.stopPropagation();
                  select(item.id);
                }}
              >
                <sphereGeometry args={[isSelected ? DOT_RADIUS * 1.25 : DOT_RADIUS, 24, 16]} />
                <meshStandardMaterial color={item.color} roughness={0.45} metalness={0.05} />
              </mesh>
              {isSelected && (
                <Billboard>
                  <mesh raycast={() => null}>
                    <ringGeometry args={[DOT_RADIUS * 1.6, DOT_RADIUS * 2, 40]} />
                    <meshBasicMaterial color={item.color} transparent opacity={0.6} side={DoubleSide} depthWrite={false} />
                  </mesh>
                </Billboard>
              )}
            </group>
          );
        }),
      )}
      {tooltip && (
        <Html position={tooltip.position} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div className={styles.tooltip}>
            {tooltip.lines.map((l, i) => (
              <div key={i} className={styles.tooltipLine}>
                <span className={styles.tooltipDot} style={{ background: l.color }} />
                {l.name}
              </div>
            ))}
            <div className={styles.tooltipCoords}>{tooltip.coords}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
