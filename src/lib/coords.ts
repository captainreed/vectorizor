import { STEP_MAX, type AxisId, type LineItem, type PlaneId, type PlanePoint } from '../state/schema';

export type Vec3 = [number, number, number];

/** The two axes each plane spans, in slider order (a, b). */
export const PLANE_AXES: Record<PlaneId, [AxisId, AxisId]> = {
  xy: ['x', 'y'],
  xz: ['x', 'z'],
  yz: ['y', 'z'],
};

export const AXIS_COLORS: Record<AxisId, string> = {
  x: '#e05252',
  y: '#3fae5a',
  z: '#4a7fe0',
};

export const PLANE_TINTS: Record<PlaneId, string> = {
  xy: '#4a7fe0', // normal is Z
  xz: '#3fae5a', // normal is Y
  yz: '#e05252', // normal is X
};

/** Unit vector for an axis in three.js world space (Y-up). */
export const AXIS_DIR: Record<AxisId, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/**
 * Map a slider step to a world-space distance along an axis. A non-zero `gap` pushes every
 * non-zero step outward by that amount (e.g. gap 1: steps ±1..±5 land at ±2..±6), leaving
 * room around the origin; step 0 stays at the origin.
 */
export function stepToWorld(step: number, gap = 0): number {
  return step === 0 ? 0 : step + Math.sign(step) * gap;
}

/** World-space half-length of each axis / grid plane spanning ±`steps`. */
export function gridExtent(gap = 0, steps = STEP_MAX): number {
  return stepToWorld(steps, gap);
}

/** Apply `stepToWorld` to each component of a point given in step units. */
export function stepsToWorld(v: Vec3, gap = 0): Vec3 {
  return [stepToWorld(v[0], gap), stepToWorld(v[1], gap), stepToWorld(v[2], gap)];
}

/** Single mode: the sum of an item's three plane vectors, in step units (each axis −10..10). */
export function resultant(points: LineItem['points']): Vec3 {
  return [points.xy.a + points.xz.a, points.xy.b + points.yz.a, points.xz.b + points.yz.b];
}

/** Something drawn for an item: one of its plane points, or (Single mode) its 3D resultant. */
export interface Marker {
  id: PlaneId | 'xyz';
  /** Position in step units, before any Person-mode gap is applied. */
  steps: Vec3;
  /** Human-readable coordinates for tooltips, e.g. "XY (3, −2)". */
  label: string;
}

export function itemMarkers(item: LineItem, planes: readonly PlaneId[], single: boolean): Marker[] {
  if (single) {
    const steps = resultant(item.points);
    return [{ id: 'xyz', steps, label: `XYZ ${formatCoords(steps)}` }];
  }
  return planes.map((plane) => ({
    id: plane,
    steps: planePointTo3D(plane, item.points[plane]),
    label: `${plane.toUpperCase()} ${formatPoint(item.points[plane])}`,
  }));
}

/** Map a 2D point on a plane to its 3D world position. */
export function planePointTo3D(plane: PlaneId, p: PlanePoint, gap = 0): Vec3 {
  const a = stepToWorld(p.a, gap);
  const b = stepToWorld(p.b, gap);
  switch (plane) {
    case 'xy':
      return [a, b, 0];
    case 'xz':
      return [a, 0, b];
    case 'yz':
      return [0, a, b];
  }
}

/**
 * Place a force vector so it pushes on a sphere: same direction and length as `force`, slid back
 * along itself until its tip touches the sphere's surface, pointing at the center.
 * Returns null for a zero force.
 */
export function pushArrow(force: Vec3, center: Vec3, radius: number): { tail: Vec3; tip: Vec3 } | null {
  const len = Math.hypot(...force);
  if (len < 1e-6) return null;
  const tip = center.map((c, i) => c - (force[i] / len) * radius) as Vec3;
  const tail = tip.map((t, i) => t - force[i]) as Vec3;
  return { tail, tip };
}

/** "(a, b, …)" with real minus signs. */
export function formatCoords(values: readonly number[]): string {
  const f = (n: number) => (n < 0 ? `−${-n}` : String(n));
  return `(${values.map(f).join(', ')})`;
}

export function formatPoint(p: PlanePoint): string {
  return formatCoords([p.a, p.b]);
}
