import {
  AXIS_DIR,
  axisInPlane,
  formatCoords,
  formatPoint,
  gridExtent,
  itemMarkers,
  planeNormal,
  planePointTo3D,
  pushArrow,
  resultant,
  stepToWorld,
  stepsToWorld,
  type Vec3,
} from '../src/lib/coords';
import { DEFAULT_DIAGONALS, DIAGONAL_IDS, type LineItem } from '../src/state/schema';

const baseItem: LineItem = {
  id: 'i',
  name: 'A',
  color: '#000000',
  description: '',
  visible: true,
  points: { xy: { a: 0, b: 0 }, xz: { a: 0, b: 0 }, yz: { a: 0, b: 0 } },
  diagonals: DEFAULT_DIAGONALS,
};

const expectClose = (actual: Vec3, expected: Vec3) =>
  actual.forEach((n, i) => expect(n).toBeCloseTo(expected[i], 9));

const H = Math.SQRT1_2;

describe('planePointTo3D', () => {
  it('maps XY plane points to z = 0', () => {
    expect(planePointTo3D('xy', { a: 2, b: -3 })).toEqual([2, -3, 0]);
  });
  it('maps XZ plane points to y = 0', () => {
    expect(planePointTo3D('xz', { a: 4, b: 1 })).toEqual([4, 0, 1]);
  });
  it('maps YZ plane points to x = 0', () => {
    expect(planePointTo3D('yz', { a: -5, b: 5 })).toEqual([0, -5, 5]);
  });
});

describe('formatPoint', () => {
  it('uses a real minus sign', () => {
    expect(formatPoint({ a: -2, b: 3 })).toBe('(−2, 3)');
  });
});

describe('stepToWorld / gap', () => {
  it('is the identity with no gap', () => {
    expect([-5, -1, 0, 1, 5].map((s) => stepToWorld(s))).toEqual([-5, -1, 0, 1, 5]);
  });
  it('pushes non-zero steps outward by the gap, leaving 0 at the origin', () => {
    expect([-5, -1, 0, 1, 5].map((s) => stepToWorld(s, 1))).toEqual([-6, -2, 0, 2, 6]);
    expect(gridExtent(1)).toBe(6);
  });
  it('applies the gap to plane points', () => {
    expect(planePointTo3D('xz', { a: 3, b: -2 }, 1)).toEqual([4, 0, -3]);
    expect(planePointTo3D('yz', { a: 0, b: 1 }, 1)).toEqual([0, 0, 2]);
  });
});

describe('pushArrow', () => {
  it('slides the force back so its tip touches the sphere, keeping direction and length', () => {
    // Force of 3 along +X on a unit sphere at the origin: tip at (-1,0,0), tail at (-4,0,0).
    expect(pushArrow([3, 0, 0], [0, 0, 0], 1)).toEqual({ tail: [-4, 0, 0], tip: [-1, 0, 0] });
  });
  it('works off-axis and around a moved sphere', () => {
    const a = pushArrow([3, 4, 0], [1, 1, 1], 1)!;
    expect(a.tip.map((n) => +n.toFixed(6))).toEqual([0.4, 0.2, 1]);
    expect(a.tail.map((n) => +n.toFixed(6))).toEqual([-2.6, -3.8, 1]);
  });
  it('returns null for a zero force', () => {
    expect(pushArrow([0, 0, 0], [0, 0, 0], 1)).toBeNull();
  });
});

describe('Single mode helpers', () => {
  const points = { xy: { a: 3, b: 0 }, xz: { a: 2, b: -4 }, yz: { a: 1, b: 0 } };
  const item = { ...baseItem, points };
  const opts = { planes: ['xy', 'xz', 'yz'] as const, diagonals: [], single: true, compass: false, gap: 0 };

  it('resultant sums the two values each axis gets from the planes', () => {
    expect(resultant(item)).toEqual([5, 1, -4]);
  });

  it('itemMarkers gives one 3D marker in Single mode, one per plane otherwise', () => {
    expect(itemMarkers(item, opts)).toEqual([
      { id: 'xyz', steps: [5, 1, -4], world: [5, 1, -4], label: 'XYZ (5, 1, −4)' },
    ]);
    const planar = itemMarkers(item, { ...opts, planes: ['xz'], single: false, gap: 1 });
    expect(planar).toEqual([{ id: 'xz', steps: [2, 0, -4], world: [3, 0, -5], label: 'XZ (2, −4)' }]);
  });

  it('grid extent and world mapping cover the doubled range', () => {
    expect(gridExtent(0, 10)).toBe(10);
    expect(gridExtent(1, 10)).toBe(11);
    expect(stepsToWorld([5, 0, -10], 1)).toEqual([6, 0, -11]);
  });

  it('formatCoords handles any arity', () => {
    expect(formatCoords([1, -2, 0])).toBe('(1, −2, 0)');
  });
});

describe('Compass geometry', () => {
  it('every axis direction is a unit vector', () => {
    for (const dir of Object.values(AXIS_DIR)) expect(Math.hypot(...dir)).toBeCloseTo(1, 12);
  });

  it('diagonals lie in the expected planes', () => {
    expect(axisInPlane('ne', 'xz')).toBe(true);
    expect(axisInPlane('nw', 'xz')).toBe(true);
    expect(axisInPlane('ne', 'ne-y')).toBe(true);
    expect(axisInPlane('une', 'ne-y')).toBe(true);
    expect(axisInPlane('unw', 'nw-y')).toBe(true);
    expect(axisInPlane('une', 'xz')).toBe(false);
    expect(axisInPlane('nw', 'ne-y')).toBe(false);
  });

  it('diagonals sit at 45° to their neighbors', () => {
    const angle = (a: Vec3, b: Vec3) => (Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * 180) / Math.PI;
    expect(angle(AXIS_DIR.ne, AXIS_DIR.x)).toBeCloseTo(45);
    expect(angle(AXIS_DIR.ne, AXIS_DIR.z)).toBeCloseTo(45);
    expect(angle(AXIS_DIR.une, AXIS_DIR.y)).toBeCloseTo(45);
    expect(angle(AXIS_DIR.une, AXIS_DIR.ne)).toBeCloseTo(45);
  });

  it('plane normals match the original isolate camera poses', () => {
    expectClose(planeNormal('xy'), [0, 0, 1]);
    expectClose(planeNormal('xz'), [0, -1, 0]);
    expectClose(planeNormal('yz'), [1, 0, 0]);
    expectClose(planeNormal('ne-y'), [-H, 0, H]);
  });

  it('maps points on the 45° planes', () => {
    expectClose(planePointTo3D('ne-y', { a: 2, b: 3 }), [2 * H, 3, 2 * H]);
    expectClose(planePointTo3D('nw-y', { a: 2, b: 0 }, 1), [-3 * H, 0, 3 * H]);
  });

  it('diagonal markers: raw force in steps, gap applied along the diagonal, zeros skipped', () => {
    const item = { ...baseItem, diagonals: { ...DEFAULT_DIAGONALS, ne: 3, unw: -2 } };
    const markers = itemMarkers(item, { planes: [], diagonals: DIAGONAL_IDS, single: false, compass: true, gap: 1 });
    expect(markers.map((m) => m.id)).toEqual(['ne', 'unw']);
    expectClose(markers[0].steps, [3 * H, 0, 3 * H]);
    expectClose(markers[0].world, [4 * H, 0, 4 * H]);
    expect(markers[0].label).toBe('NE (3)');
    expectClose(markers[1].world, [1.5, -3 * H, -1.5]);
  });

  it('Single resultant adds diagonals only when Compass is on', () => {
    const item = { ...baseItem, diagonals: { ...DEFAULT_DIAGONALS, ne: 2, une: 2 } };
    expectClose(resultant(item, false), [0, 0, 0]);
    expectClose(resultant(item, true), [2 * H + 1, 2 * H, 2 * H + 1]);
  });

  it('formatCoords rounds to 2 decimals and never prints −0', () => {
    expect(formatCoords([Math.SQRT2, -0.0001, -2.554])).toBe('(1.41, 0, −2.55)');
  });
});
