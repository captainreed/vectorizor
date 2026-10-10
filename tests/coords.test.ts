import {
  AXIS_DIR,
  activeCompassPlanes,
  axisInPlane,
  formatCoords,
  outwardArrow,
  resultCenter,
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
import { ALL_AXIS_IDS, DEFAULT_VALUES, type LineItem } from '../src/state/schema';

const makeItem = (values: Partial<LineItem['values']> = {}, visible = true): LineItem => ({
  id: 'i',
  name: 'A',
  color: '#000000',
  description: '',
  visible,
  values: { ...DEFAULT_VALUES, ...values },
});

const expectClose = (actual: Vec3, expected: Vec3) =>
  actual.forEach((n, i) => expect(n).toBeCloseTo(expected[i], 9));

const H = Math.SQRT1_2;

describe('planePointTo3D (grid geometry)', () => {
  it('maps main-plane coordinates', () => {
    expect(planePointTo3D('xy', { a: 2, b: -3 })).toEqual([2, -3, 0]);
    expect(planePointTo3D('xz', { a: 4, b: 1 })).toEqual([4, 0, 1]);
    expect(planePointTo3D('yz', { a: -5, b: 5 })).toEqual([0, -5, 5]);
  });
  it('applies the gap', () => {
    expect(planePointTo3D('xz', { a: 3, b: -2 }, 1)).toEqual([4, 0, -3]);
  });
  it('maps points on the 45° planes', () => {
    expectClose(planePointTo3D('ne-y', { a: 2, b: 3 }), [2 * H, 3, 2 * H]);
    expectClose(planePointTo3D('nw-y', { a: 2, b: 0 }, 1), [-3 * H, 0, 3 * H]);
  });
});

describe('stepToWorld / gap', () => {
  it('is the identity with no gap', () => {
    expect([-5, -1, 0, 1, 5].map((s) => stepToWorld(s))).toEqual([-5, -1, 0, 1, 5]);
  });
  it('pushes non-zero steps outward by the gap, leaving 0 at the origin', () => {
    expect([-5, -1, 0, 1, 5].map((s) => stepToWorld(s, 1))).toEqual([-6, -2, 0, 2, 6]);
    expect(gridExtent(1)).toBe(6);
    expect(gridExtent(1, 10)).toBe(11);
    expect(stepsToWorld([5, 0, -10], 1)).toEqual([6, 0, -11]);
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

describe('axis geometry', () => {
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
});

describe('compass planes', () => {
  it('appear only while a visible item has a non-zero value on one of their diagonals', () => {
    expect(activeCompassPlanes([makeItem({ x: 3 })])).toEqual([]);
    expect(activeCompassPlanes([makeItem({ une: -1 })])).toEqual(['ne-y']);
    expect(activeCompassPlanes([makeItem({ nw: 2 }), makeItem({ ne: 1 })])).toEqual(['ne-y', 'nw-y']);
    expect(activeCompassPlanes([makeItem({ ne: 4 }, false)])).toEqual([]);
  });
});

describe('itemMarkers', () => {
  const all = { axes: ALL_AXIS_IDS, single: false, gap: 0 };

  it('one marker per non-zero axis value, gap applied along the axis', () => {
    const markers = itemMarkers(makeItem({ x: 3, z: -2, ne: 3 }), { ...all, gap: 1 });
    expect(markers.map((m) => m.id)).toEqual(['x', 'z', 'ne']);
    expect(markers[0]).toMatchObject({ steps: [3, 0, 0], world: [4, 0, 0], label: 'X (3)' });
    expectClose(markers[2].steps, [3 * H, 0, 3 * H]);
    expectClose(markers[2].world, [4 * H, 0, 4 * H]);
    expect(markers[2].label).toBe('NE (3)');
  });

  it('a new item (all sliders centered) draws nothing', () => {
    expect(itemMarkers(makeItem(), all)).toEqual([]);
  });

  it('only shows the requested axes', () => {
    expect(itemMarkers(makeItem({ x: 1, y: 1 }), { ...all, axes: ['x'] }).map((m) => m.id)).toEqual(['x']);
  });

  it('Single mode gives one marker at the sum of every axis vector', () => {
    const item = makeItem({ x: 3, y: 1, z: -4, ne: 2, une: 2 });
    expectClose(resultant(item), [3 + 2 * H + 1, 1 + 2 * H, -4 + 2 * H + 1]);
    const [sum] = itemMarkers(makeItem({ x: 3, y: 1, z: -4 }), { ...all, single: true });
    expect(sum).toEqual({ id: 'sum', steps: [3, 1, -4], world: [3, 1, -4], label: 'Sum (3, 1, −4)' });
  });
});

describe('formatCoords', () => {
  it('uses real minus signs, rounds to 2 decimals and never prints −0', () => {
    expect(formatCoords([1, -2, 0])).toBe('(1, −2, 0)');
    expect(formatCoords([Math.SQRT2, -0.0001, -2.554])).toBe('(1.41, 0, −2.55)');
  });
});

describe('outwardArrow', () => {
  it('starts at the origin without a sphere', () => {
    expect(outwardArrow([4, 0, 0], null)).toEqual({ tail: [0, 0, 0], tip: [4, 0, 0] });
  });

  it('starts on the sphere surface with Person on, tip inset from the dot', () => {
    expect(outwardArrow([4, 0, 0], { center: [0, 0, 0], radius: 1 }, 0.1)).toEqual({
      tail: [1, 0, 0],
      tip: [3.9, 0, 0],
    });
    const a = outwardArrow([0, 3, 4], { center: [0, 0, 0], radius: 1 })!;
    expectClose(a.tail, [0, 0.6, 0.8]);
  });

  it('measures from a moved sphere, and skips points inside it', () => {
    expect(outwardArrow([4, 1, 0], { center: [0, 1, 0], radius: 1 })).toEqual({ tail: [1, 1, 0], tip: [4, 1, 0] });
    expect(outwardArrow([0.5, 0, 0], { center: [0, 0, 0], radius: 1 })).toBeNull();
  });
});

describe('resultCenter (Result mode)', () => {
  it('is the average of every visible dot, where equal springs balance', () => {
    // Dots at +4 and −1 on X: springs balance at 1.5.
    const items = [makeItem({ x: 4 }), { ...makeItem({ x: -1 }), id: 'b' }];
    expect(resultCenter(items, { single: false, gap: 0 })).toEqual([1.5, 0, 0]);
  });

  it('uses each axis dot (and diagonals) of an item, and the dots as drawn with the gap', () => {
    // One item with X 2 and Z −2 (two dots): average (1, 0, −1); with the gap the dots sit at ±3.
    expect(resultCenter([makeItem({ x: 2, z: -2 })], { single: false, gap: 0 })).toEqual([1, 0, -1]);
    expect(resultCenter([makeItem({ x: 2, z: -2 })], { single: false, gap: 1 })).toEqual([1.5, 0, -1.5]);
    expectClose(resultCenter([makeItem({ ne: 2 })], { single: false, gap: 0 })!, [2 * H, 0, 2 * H]);
  });

  it('uses the sum dots in Single mode, ignores hidden items, and is null with no dots', () => {
    expect(resultCenter([makeItem({ x: 2, y: 4 })], { single: true, gap: 0 })).toEqual([2, 4, 0]);
    expect(resultCenter([makeItem({ x: 3 }, false)], { single: false, gap: 0 })).toBeNull();
    expect(resultCenter([makeItem()], { single: false, gap: 0 })).toBeNull();
  });
});
