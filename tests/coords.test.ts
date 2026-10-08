import { formatPoint, planePointTo3D } from '../src/lib/coords';

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
