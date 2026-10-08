import type { AxisId, PlaneId, PlanePoint } from '../state/schema';

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

/** Map a 2D point on a plane to its 3D world position. */
export function planePointTo3D(plane: PlaneId, p: PlanePoint): Vec3 {
  switch (plane) {
    case 'xy':
      return [p.a, p.b, 0];
    case 'xz':
      return [p.a, 0, p.b];
    case 'yz':
      return [0, p.a, p.b];
  }
}

export function formatPoint(p: PlanePoint): string {
  const f = (n: number) => (n < 0 ? `−${-n}` : String(n));
  return `(${f(p.a)}, ${f(p.b)})`;
}
