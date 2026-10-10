import {
  DIAGONAL_IDS,
  STEP_MAX,
  type AnyAxisId,
  type AxisId,
  type DiagonalId,
  type IsolatePlane,
  type LineItem,
  type PlaneId,
  type PlanePoint,
} from '../state/schema';

export type Vec3 = [number, number, number];

/** The two axes each plane spans, in slider order (a, b). */
export const PLANE_AXES: Record<PlaneId, [AxisId, AxisId]> = {
  xy: ['x', 'y'],
  xz: ['x', 'z'],
  yz: ['y', 'z'],
};

/**
 * The two axes spanning every drawable plane, as (screen-right, screen-up) when isolated.
 * The Compass planes are XY and YZ rotated 45° about Y.
 */
export const PLANE_BASIS: Record<IsolatePlane, [AnyAxisId, AnyAxisId]> = {
  ...PLANE_AXES,
  'ne-y': ['ne', 'y'],
  'nw-y': ['nw', 'y'],
};

export const AXIS_COLORS: Record<AnyAxisId, string> = {
  x: '#e05252',
  y: '#3fae5a',
  z: '#4a7fe0',
  ne: '#9b59b6',
  nw: '#e67e22',
  une: '#17a2b8',
  unw: '#b8860b',
};

export const PLANE_TINTS: Record<IsolatePlane, string> = {
  xy: '#4a7fe0', // normal is Z
  xz: '#3fae5a', // normal is Y
  yz: '#e05252', // normal is X
  'ne-y': '#9b59b6',
  'nw-y': '#e67e22',
};

const H = Math.SQRT1_2;

/** Unit vector for an axis in three.js world space (Y-up, floor = XZ). */
export const AXIS_DIR: Record<AnyAxisId, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
  ne: [H, 0, H], // floor, between +X and +Z
  nw: [-H, 0, H], // floor, between −X and +Z
  une: [0.5, H, 0.5], // between +Y and +NE
  unw: [-0.5, H, 0.5], // between +Y and +NW
};

/** Short names used in tooltips and summaries. */
export const DIAGONAL_SHORT: Record<DiagonalId, string> = { ne: 'NE', nw: 'NW', une: 'Up-NE', unw: 'Up-NW' };

const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Unit normal of a plane (basis a × basis b); the isolate camera looks from this side. */
export function planeNormal(plane: IsolatePlane): Vec3 {
  const [a, b] = PLANE_BASIS[plane];
  return cross(AXIS_DIR[a], AXIS_DIR[b]);
}

/** Whether an axis direction lies within a plane. */
export function axisInPlane(axis: AnyAxisId, plane: IsolatePlane): boolean {
  return Math.abs(dot(AXIS_DIR[axis], planeNormal(plane))) < 1e-9;
}

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

/** World position of plane coordinates (a, b), measured in steps along the plane's two axes. */
export function planePointTo3D(plane: IsolatePlane, p: PlanePoint, gap = 0): Vec3 {
  const [u, v] = PLANE_BASIS[plane];
  return add(scale(AXIS_DIR[u], stepToWorld(p.a, gap)), scale(AXIS_DIR[v], stepToWorld(p.b, gap)));
}

/**
 * Single mode: the sum of an item's plane vectors (each axis −10..10), plus with Compass each
 * diagonal value along its direction. In step units; may be fractional with Compass.
 */
export function resultant(item: Pick<LineItem, 'points' | 'diagonals'>, compass = false): Vec3 {
  const { points } = item;
  let sum: Vec3 = [points.xy.a + points.xz.a, points.xy.b + points.yz.a, points.xz.b + points.yz.b];
  if (compass) for (const d of DIAGONAL_IDS) sum = add(sum, scale(AXIS_DIR[d], item.diagonals[d]));
  return sum;
}

/** Something drawn for an item: a plane point, a diagonal value, or (Single mode) its 3D resultant. */
export interface Marker {
  id: PlaneId | DiagonalId | 'xyz';
  /** Raw vector in step units, before any Person-mode gap; used for sums and Push forces. */
  steps: Vec3;
  /** Where to draw it, with the gap applied. */
  world: Vec3;
  /** Human-readable coordinates for tooltips, e.g. "XY (3, −2)". */
  label: string;
}

export interface MarkerOptions {
  /** Planes whose 2D points are shown. */
  planes: readonly PlaneId[];
  /** Diagonals whose values are shown (Compass mode). */
  diagonals: readonly DiagonalId[];
  single: boolean;
  /** Whether diagonal values count toward the Single resultant. */
  compass: boolean;
  gap: number;
}

export function itemMarkers(item: LineItem, { planes, diagonals, single, compass, gap }: MarkerOptions): Marker[] {
  if (single) {
    const steps = resultant(item, compass);
    return [{ id: 'xyz', steps, world: stepsToWorld(steps, gap), label: `XYZ ${formatCoords(steps)}` }];
  }
  const markers: Marker[] = planes.map((plane) => ({
    id: plane,
    steps: planePointTo3D(plane, item.points[plane]),
    world: planePointTo3D(plane, item.points[plane], gap),
    label: `${plane.toUpperCase()} ${formatPoint(item.points[plane])}`,
  }));
  for (const d of diagonals) {
    const v = item.diagonals[d];
    if (v === 0) continue; // nothing to show along a diagonal at 0
    markers.push({
      id: d,
      steps: scale(AXIS_DIR[d], v),
      // The gap applies along the diagonal itself, like it does along X/Y/Z.
      world: scale(AXIS_DIR[d], stepToWorld(v, gap)),
      label: `${DIAGONAL_SHORT[d]} ${formatCoords([v])}`,
    });
  }
  return markers;
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

/** "(a, b, …)" with real minus signs, rounded to 2 decimals. */
export function formatCoords(values: readonly number[]): string {
  const f = (n: number) => {
    const r = Math.round(n * 100) / 100;
    if (r === 0) return '0'; // also catches −0
    return r < 0 ? `−${-r}` : String(r);
  };
  return `(${values.map(f).join(', ')})`;
}

export function formatPoint(p: PlanePoint): string {
  return formatCoords([p.a, p.b]);
}
