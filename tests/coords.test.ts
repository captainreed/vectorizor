import {
  formatCoords,
  formatPoint,
  gridExtent,
  itemMarkers,
  planePointTo3D,
  pushArrow,
  resultant,
  stepToWorld,
  stepsToWorld,
} from '../src/lib/coords';

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
  const item = { id: 'i', name: 'A', color: '#000000', description: '', visible: true, points };

  it('resultant sums the two values each axis gets from the planes', () => {
    expect(resultant(points)).toEqual([5, 1, -4]);
  });

  it('itemMarkers gives one 3D marker in Single mode, one per plane otherwise', () => {
    expect(itemMarkers(item, ['xy', 'xz', 'yz'], true)).toEqual([
      { id: 'xyz', steps: [5, 1, -4], label: 'XYZ (5, 1, −4)' },
    ]);
    const planar = itemMarkers(item, ['xz'], false);
    expect(planar).toEqual([{ id: 'xz', steps: [2, 0, -4], label: 'XZ (2, −4)' }]);
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
