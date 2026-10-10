import {
  ALL_AXIS_IDS,
  DIAGONAL_PLANE_IDS,
  STEP_MAX,
  type AnyAxisId,
  type AxisId,
  type DiagonalId,
  type DiagonalPlaneId,
  type IsolatePlane,
  type LineItem,
  type PlaneId,
  type PlanePoint,
} from '../state/schema';

export type Vec3 = [number, number, number];

/** The two axes each main plane spans. */
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

/** Fixed short names (not the user-editable labels), used in tooltips and accessible labels. */
export const AXIS_SHORT: Record<AnyAxisId, string> = {
  x: 'X',
  y: 'Y',
  z: 'Z',
  ne: 'NE',
  nw: 'NW',
  une: 'Up-NE',
  unw: 'Up-NW',
};

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

/** The two diagonals lying in each compass plane; the plane is shown while either is in use. */
export const COMPASS_PLANE_AXES: Record<DiagonalPlaneId, [DiagonalId, DiagonalId]> = {
  'ne-y': ['ne', 'une'],
  'nw-y': ['nw', 'unw'],
};

/** Compass planes in use: some visible item has a non-zero value on one of their diagonals. */
export function activeCompassPlanes(items: readonly LineItem[]): DiagonalPlaneId[] {
  return DIAGONAL_PLANE_IDS.filter((plane) =>
    items.some((i) => i.visible && COMPASS_PLANE_AXES[plane].some((d) => i.values[d] !== 0)),
  );
}

/**
 * Single mode: the sum of the item's per-axis vectors (each value along its axis direction).
 * In step units; fractional when diagonals are involved.
 */
export function resultant(item: Pick<LineItem, 'values'>): Vec3 {
  return ALL_AXIS_IDS.reduce<Vec3>((sum, axis) => add(sum, scale(AXIS_DIR[axis], item.values[axis])), [0, 0, 0]);
}

/** Something drawn for an item: one axis value, or (Single mode) its 3D resultant. */
export interface Marker {
  id: AnyAxisId | 'sum';
  /** Raw vector in step units, before any Person-mode gap; used for sums and Push forces. */
  steps: Vec3;
  /** Where to draw it, with the gap applied. */
  world: Vec3;
  /** Human-readable value for tooltips, e.g. "X (3)" or "Sum (1, 2.12, 0)". */
  label: string;
}

export interface MarkerOptions {
  /** Axes whose values are shown (all of them in 3D; those lying in the plane when isolated). */
  axes: readonly AnyAxisId[];
  single: boolean;
  gap: number;
}

export function itemMarkers(item: LineItem, { axes, single, gap }: MarkerOptions): Marker[] {
  if (single) {
    const steps = resultant(item);
    return [{ id: 'sum', steps, world: stepsToWorld(steps, gap), label: `Sum ${formatCoords(steps)}` }];
  }
  const markers: Marker[] = [];
  for (const axis of axes) {
    const v = item.values[axis];
    if (v === 0) continue; // nothing to show along an axis at 0
    markers.push({
      id: axis,
      steps: scale(AXIS_DIR[axis], v),
      // Person-mode gap applies along the axis itself.
      world: scale(AXIS_DIR[axis], stepToWorld(v, gap)),
      label: `${AXIS_SHORT[axis]} ${formatCoords([v])}`,
    });
  }
  return markers;
}

/**
 * Result mode: where the person sphere settles if every dot pulls on it with an identical spring.
 * Springs balance where the offsets to all dots sum to zero, i.e. at the dots' average position.
 * Uses every visible dot as drawn (all axes, or the sums in Single mode), independent of the view.
 * Returns null when there are no dots.
 */
export function resultCenter(items: readonly LineItem[], { single, gap }: { single: boolean; gap: number }): Vec3 | null {
  const dots = items
    .filter((i) => i.visible)
    .flatMap((i) => itemMarkers(i, { axes: ALL_AXIS_IDS, single, gap }))
    .map((m) => m.world);
  if (dots.length === 0) return null;
  return scale(dots.reduce<Vec3>(add, [0, 0, 0]), 1 / dots.length);
}

/** The person sphere, when Person mode is on. */
export interface Sphere {
  center: Vec3;
  radius: number;
}

/**
 * Arrow from the origin out to `point`, or, with a `sphere`, from the sphere's surface (along the
 * line from its center to the point). The tip stops `tipInset` short of the point. Returns null if
 * the point is at the start or inside the sphere.
 */
export function outwardArrow(point: Vec3, sphere: Sphere | null, tipInset = 0): { tail: Vec3; tip: Vec3 } | null {
  const origin: Vec3 = sphere ? sphere.center : [0, 0, 0];
  const startAt = sphere ? sphere.radius : 0;
  const offset: Vec3 = [point[0] - origin[0], point[1] - origin[1], point[2] - origin[2]];
  const len = Math.hypot(...offset);
  if (len <= startAt + 1e-6) return null;
  const dir = scale(offset, 1 / len);
  return { tail: add(origin, scale(dir, startAt)), tip: add(point, scale(dir, -tipInset)) };
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
