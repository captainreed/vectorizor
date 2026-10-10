import { useEffect, useState } from 'react';
import { Billboard, Html } from '@react-three/drei';
import { DoubleSide } from 'three';
import { useStore } from '../../state/store';
import type { PlaneId } from '../../state/schema';
import { itemMarkers, stepsToWorld, type Marker, type Vec3 } from '../../lib/coords';
import styles from './Graph.module.css';

export const DOT_RADIUS = 0.18;

interface Hover {
  itemId: string;
  markerId: Marker['id'];
}

const sameSteps = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Colored spheres for each visible item's markers: one per displayed plane, or one 3D point in Single mode. */
export default function PointDots({ planes, gap, single }: { planes: PlaneId[]; gap: number; single: boolean }) {
  const items = useStore((s) => s.items);
  const selectedId = useStore((s) => s.ui.selectedId);
  const select = useStore((s) => s.select);
  const [hover, setHover] = useState<Hover | null>(null);

  const visible = items
    .filter((i) => i.visible)
    .map((item) => ({ item, markers: itemMarkers(item, planes, single) }));

  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hover]);

  // Drop a stale hover if the item or its marker disappears (e.g. Single toggled).
  const markerFor = (itemId: string, markerId: Marker['id']) =>
    visible.find((v) => v.item.id === itemId)?.markers.find((m) => m.id === markerId);
  const hoverMarker = hover && markerFor(hover.itemId, hover.markerId);

  let tooltip: { position: Vec3; lines: { name: string; color: string }[]; coords: string } | null = null;
  if (hover && hoverMarker) {
    const sameSpot = visible.filter(({ markers }) =>
      markers.some((m) => m.id === hover.markerId && sameSteps(m.steps, hoverMarker.steps)),
    );
    tooltip = {
      position: stepsToWorld(hoverMarker.steps, gap),
      lines: sameSpot.map(({ item }) => ({ name: item.name || 'Untitled', color: item.color })),
      coords: hoverMarker.label,
    };
  }

  return (
    <group>
      {visible.map(({ item, markers }) =>
        markers.map((marker) => {
          const isSelected = item.id === selectedId;
          return (
            <group key={`${item.id}-${marker.id}`} position={stepsToWorld(marker.steps, gap)}>
              <mesh
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHover({ itemId: item.id, markerId: marker.id });
                }}
                onPointerOut={() =>
                  setHover((h) => (h?.itemId === item.id && h.markerId === marker.id ? null : h))
                }
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
