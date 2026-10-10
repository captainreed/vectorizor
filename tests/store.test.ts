import { getDocument, selectAxisGap, selectGridSteps, selectIsolatePlane, useStore } from '../src/state/store';
import {
  DEFAULT_AXES,
  DEFAULT_MODES,
  DEFAULT_PERSON,
  DEFAULT_VALUES,
  DEFAULT_VIEW,
  EXPORT_VERSION,
  PALETTE,
  documentSchema,
  exportFileSchema,
} from '../src/state/schema';

const reset = () =>
  useStore.setState({
    items: [],
    axes: DEFAULT_AXES,
    view: DEFAULT_VIEW,
    modes: DEFAULT_MODES,
    person: DEFAULT_PERSON,
    ui: { expandedId: null, selectedId: null, keyEditing: false, cameraNonce: 0 },
  });

beforeEach(reset);

describe('store', () => {
  it('adds items with defaults, distinct colors, all 7 sliders centered, expanded', () => {
    const s = useStore.getState();
    const id1 = s.addItem();
    const id2 = useStore.getState().addItem();
    const { items, ui } = useStore.getState();
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: id1,
      name: 'Item 1',
      color: PALETTE[0],
      visible: true,
      values: { x: 0, y: 0, z: 0, ne: 0, nw: 0, une: 0, unw: 0 },
    });
    expect(items[1].color).not.toBe(items[0].color);
    expect(ui.expandedId).toBe(id2);
  });

  it('sets and clamps slider values to -5..5 integers', () => {
    const id = useStore.getState().addItem();
    const { setValue } = useStore.getState();
    setValue(id, 'z', 3);
    setValue(id, 'x', 9);
    setValue(id, 'unw', -2.6);
    expect(useStore.getState().items[0].values).toEqual({ ...DEFAULT_VALUES, z: 3, x: 5, unw: -3 });
  });

  it('toggles visibility and deletes, clearing ui references', () => {
    const id = useStore.getState().addItem();
    useStore.getState().toggleVisible(id);
    expect(useStore.getState().items[0].visible).toBe(false);
    useStore.getState().deleteItem(id);
    expect(useStore.getState().items).toHaveLength(0);
    expect(useStore.getState().ui.expandedId).toBeNull();
    expect(useStore.getState().ui.selectedId).toBeNull();
  });

  it('select from graph expands the row; null clears selection only', () => {
    const a = useStore.getState().addItem();
    useStore.getState().addItem();
    useStore.getState().select(a);
    expect(useStore.getState().ui).toMatchObject({ selectedId: a, expandedId: a });
    useStore.getState().select(null);
    expect(useStore.getState().ui).toMatchObject({ selectedId: null, expandedId: a });
  });

  it('presets switch mode and bump the camera nonce', () => {
    useStore.getState().setPreset('top');
    expect(useStore.getState().view).toMatchObject({ mode: 'preset', preset: 'top' });
    expect(useStore.getState().ui.cameraNonce).toBe(1);
    useStore.getState().setIsolatePlane('yz');
    expect(useStore.getState().view).toMatchObject({ mode: 'isolate', isolatePlane: 'yz' });
  });

  it('edits axis labels, including diagonals', () => {
    useStore.getState().setAxisLabel('y', { name: 'Energy', posLabel: 'High' });
    expect(useStore.getState().axes.y).toEqual({ name: 'Energy', negLabel: '−Y', posLabel: 'High' });
    useStore.getState().setAxisLabel('ne', { name: 'Wind' });
    expect(useStore.getState().axes.ne.name).toBe('Wind');
  });
});

describe('schema', () => {
  it('accepts a valid export and rejects out-of-range values', () => {
    useStore.getState().addItem();
    const file = { app: 'vectorizor', version: EXPORT_VERSION, data: getDocument() };
    expect(exportFileSchema.safeParse(JSON.parse(JSON.stringify(file))).success).toBe(true);

    const bad = structuredClone(getDocument());
    bad.items[0].values.ne = 6;
    expect(documentSchema.safeParse(bad).success).toBe(false);
  });

  it('migrates older per-plane items to one value per axis', () => {
    const legacyItem = {
      id: 'a',
      name: 'Old',
      color: '#123456',
      description: '',
      visible: true,
      // X: XY 4, XZ 0 → 4 (non-zero wins). Y: XY 2, YZ 3 → round(2.5) = 3 (average). Z: both 0 → 0.
      points: { xy: { a: 4, b: 2 }, xz: { a: 0, b: 0 }, yz: { a: 3, b: 0 } },
      diagonals: { ne: 1, nw: 0, une: 0, unw: -2 },
    };
    const { x, y, z } = DEFAULT_AXES;
    const parsed = documentSchema.parse({ items: [legacyItem], axes: { x, y, z }, view: DEFAULT_VIEW });
    expect(parsed.items[0].values).toEqual({ x: 4, y: 3, z: 0, ne: 1, nw: 0, une: 0, unw: -2 });
    expect(parsed.items[0]).not.toHaveProperty('points');
    expect(parsed.axes.ne).toEqual({ name: 'NE', negLabel: '−NE', posLabel: '+NE' });
    // Version-1 export files are still accepted.
    const v1 = { app: 'vectorizor', version: 1, data: { items: [legacyItem], axes: DEFAULT_AXES, view: DEFAULT_VIEW } };
    expect(exportFileSchema.safeParse(v1).success).toBe(true);
  });

  it('ignores the removed Compass mode flag in older saves', () => {
    const parsed = documentSchema.parse({
      items: [],
      axes: DEFAULT_AXES,
      view: DEFAULT_VIEW,
      modes: { person: true, compass: true },
    });
    expect(parsed.modes).toEqual({ person: true, push: false, single: false, result: false });
  });
});

describe('modes', () => {
  it('are all off by default and toggle independently of the view', () => {
    expect(useStore.getState().modes).toEqual({ person: false, push: false, single: false, result: false });
    expect(selectAxisGap(useStore.getState())).toBe(0);

    useStore.getState().toggleMode('person');
    expect(useStore.getState().modes.person).toBe(true);
    expect(selectAxisGap(useStore.getState())).toBe(1);
    expect(useStore.getState().view).toEqual(DEFAULT_VIEW);

    useStore.getState().toggleMode('person');
    expect(useStore.getState().modes.person).toBe(false);
  });

  it('person mode leaves slider values untouched', () => {
    const id = useStore.getState().addItem();
    useStore.getState().setValue(id, 'x', 3);
    useStore.getState().toggleMode('person');
    expect(useStore.getState().items[0].values.x).toBe(3);
  });

  it('person position is stored and movable', () => {
    useStore.getState().setPersonPosition([1, 2, 3]);
    expect(useStore.getState().person.position).toEqual([1, 2, 3]);
  });

  it('modes and person are exported, and older documents without them still load', () => {
    useStore.getState().toggleMode('person');
    expect(getDocument()).toMatchObject({ modes: { person: true }, person: DEFAULT_PERSON });

    const legacy = { items: [], axes: DEFAULT_AXES, view: DEFAULT_VIEW };
    const parsed = documentSchema.parse(legacy);
    expect(parsed.modes).toEqual({ person: false, push: false, single: false, result: false });
    expect(parsed.person).toEqual({ position: [0, 0, 0] });
  });
});

describe('push mode', () => {
  it('turning Push on also turns on Person', () => {
    useStore.getState().toggleMode('push');
    expect(useStore.getState().modes).toEqual({ person: true, push: true, single: false, result: false });
  });

  it('turning Person off also turns off Push; turning Push off leaves Person on', () => {
    useStore.getState().toggleMode('push');
    useStore.getState().toggleMode('person');
    expect(useStore.getState().modes).toEqual({ person: false, push: false, single: false, result: false });

    useStore.getState().toggleMode('push');
    useStore.getState().toggleMode('push');
    expect(useStore.getState().modes).toEqual({ person: true, push: false, single: false, result: false });
  });
});

describe('single mode grid', () => {
  it('sizes the grid to fit the largest visible resultant, in multiples of 5', () => {
    const id = useStore.getState().addItem();
    useStore.getState().setValue(id, 'x', 5);
    useStore.getState().setValue(id, 'ne', 5); // X = 5 + 5·√½ ≈ 8.54
    expect(selectGridSteps(useStore.getState())).toBe(5); // Single off: default grid
    useStore.getState().toggleMode('single');
    expect(selectGridSteps(useStore.getState())).toBe(10);

    useStore.getState().setValue(id, 'ne', 0); // X = 5: fits the default grid
    expect(selectGridSteps(useStore.getState())).toBe(5);

    // Every axis at 5: Z = 5 + 5√½ + 5√½ + 2.5 + 2.5 ≈ 17.07 → ±20.
    for (const a of ['x', 'y', 'z', 'ne', 'nw', 'une', 'unw'] as const) useStore.getState().setValue(id, a, 5);
    expect(selectGridSteps(useStore.getState())).toBe(20);

    useStore.getState().toggleVisible(id); // hidden items don't count
    expect(selectGridSteps(useStore.getState())).toBe(5);
  });
});

describe('vectors display', () => {
  it('older saves in the old "vectors" camera mode load as a free camera with vectors on', () => {
    const parsed = documentSchema.parse({
      items: [],
      axes: DEFAULT_AXES,
      view: { mode: 'vectors', preset: 'iso', isolatePlane: 'xy' },
    });
    expect(parsed.view).toMatchObject({ mode: 'free', vectors: true });
  });

  it('defaults to dots only when a save has no vectors flag', () => {
    const parsed = documentSchema.parse({
      items: [],
      axes: DEFAULT_AXES,
      view: { mode: 'isolate', preset: 'iso', isolatePlane: 'yz' },
    });
    expect(parsed.view).toMatchObject({ mode: 'isolate', vectors: false });
  });

  it('presets and isolate leave vectors as they were', () => {
    useStore.getState().toggleVectors();
    useStore.getState().setPreset('front');
    useStore.getState().setIsolatePlane('xz');
    expect(useStore.getState().view).toMatchObject({ mode: 'isolate', vectors: true });
  });
});

describe('compass planes and isolate', () => {
  it('a compass plane can only stay isolated while it is shown', () => {
    const id = useStore.getState().addItem();
    useStore.getState().setIsolatePlane('ne-y');
    expect(selectIsolatePlane(useStore.getState())).toBe('xy'); // no diagonals in use yet
    useStore.getState().setValue(id, 'une', 2);
    expect(selectIsolatePlane(useStore.getState())).toBe('ne-y');
    useStore.getState().setValue(id, 'une', 0);
    expect(selectIsolatePlane(useStore.getState())).toBe('xy');
  });
});

describe('grid opacity', () => {
  it('defaults to fully visible, clamps to 0..1, and older views load at 1', () => {
    expect(useStore.getState().view.gridOpacity).toBe(1);
    useStore.getState().setGridOpacity(1.7);
    expect(useStore.getState().view.gridOpacity).toBe(1);
    useStore.getState().setGridOpacity(-0.2);
    expect(useStore.getState().view.gridOpacity).toBe(0);

    const { mode, preset, isolatePlane } = DEFAULT_VIEW;
    const parsed = documentSchema.parse({ items: [], axes: DEFAULT_AXES, view: { mode, preset, isolatePlane } });
    expect(parsed.view.gridOpacity).toBe(1);
  });
});

describe('result mode', () => {
  it('turns Person on, and turning Person off turns it off', () => {
    useStore.getState().toggleMode('result');
    expect(useStore.getState().modes).toMatchObject({ person: true, result: true });
    useStore.getState().toggleMode('person');
    expect(useStore.getState().modes).toMatchObject({ person: false, result: false });
  });
});
