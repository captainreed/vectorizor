import { useStore } from '../src/state/store';
import { DEFAULT_AXES, DEFAULT_VIEW, PALETTE, documentSchema, exportFileSchema } from '../src/state/schema';

const reset = () =>
  useStore.setState({
    items: [],
    axes: DEFAULT_AXES,
    view: DEFAULT_VIEW,
    ui: { expandedId: null, selectedId: null, keyEditing: false, cameraNonce: 0 },
  });

beforeEach(reset);

describe('store', () => {
  it('adds items with defaults, distinct colors, centered sliders, expanded', () => {
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
      points: { xy: { a: 0, b: 0 }, xz: { a: 0, b: 0 }, yz: { a: 0, b: 0 } },
    });
    expect(items[1].color).not.toBe(items[0].color);
    expect(ui.expandedId).toBe(id2);
  });

  it('sets and clamps slider values to -5..5 integers', () => {
    const id = useStore.getState().addItem();
    const { setPoint } = useStore.getState();
    setPoint(id, 'xz', 'b', 3);
    setPoint(id, 'xy', 'a', 9);
    setPoint(id, 'yz', 'a', -2.6);
    const p = useStore.getState().items[0].points;
    expect(p.xz).toEqual({ a: 0, b: 3 });
    expect(p.xy.a).toBe(5);
    expect(p.yz.a).toBe(-3);
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

  it('edits axis labels', () => {
    useStore.getState().setAxisLabel('y', { name: 'Energy', posLabel: 'High' });
    expect(useStore.getState().axes.y).toEqual({ name: 'Energy', negLabel: '−Y', posLabel: 'High' });
  });
});

describe('schema', () => {
  it('accepts a valid export and rejects out-of-range points', () => {
    useStore.getState().addItem();
    const { items, axes, view } = useStore.getState();
    const file = { app: 'vectorizor', version: 1, data: { items, axes, view } };
    expect(exportFileSchema.safeParse(JSON.parse(JSON.stringify(file))).success).toBe(true);

    const bad = structuredClone({ items, axes, view });
    bad.items[0].points.xy.a = 6;
    expect(documentSchema.safeParse(bad).success).toBe(false);
  });
});
