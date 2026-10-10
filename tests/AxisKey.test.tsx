import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AxisKey from '../src/components/graph/AxisKey';
import { useStore } from '../src/state/store';
import { DEFAULT_AXES, DEFAULT_MODES, DEFAULT_VIEW } from '../src/state/schema';

beforeEach(() =>
  useStore.setState({
    items: [],
    axes: DEFAULT_AXES,
    view: DEFAULT_VIEW,
    modes: DEFAULT_MODES,
    ui: { expandedId: null, selectedId: null, keyEditing: false, cameraNonce: 0 },
  }),
);

const rowNames = () =>
  within(screen.getByRole('region', { name: 'Axis key' }))
    .getAllByRole('row')
    .slice(1) // header
    .map((r) => within(r).getAllByRole('cell')[0].textContent);

describe('axis key', () => {
  it('shows X/Y/Z only, with More revealing all 4 diagonals', () => {
    render(<AxisKey />);
    expect(rowNames()).toEqual(['X', 'Y', 'Z']);

    fireEvent.click(screen.getByRole('button', { name: /more \(4\)/i }));
    expect(rowNames()).toEqual(['X', 'Y', 'Z', 'NE', 'NW', 'Up-NE', 'Up-NW']);

    fireEvent.click(screen.getByRole('button', { name: /less/i }));
    expect(rowNames()).toEqual(['X', 'Y', 'Z']);
  });

  it('always shows diagonals that a visible item is using', () => {
    const id = useStore.getState().addItem();
    render(<AxisKey />);
    act(() => useStore.getState().setValue(id, 'unw', -2));
    expect(rowNames()).toEqual(['X', 'Y', 'Z', 'Up-NW']);
    expect(screen.getByRole('button', { name: /more \(3\)/i })).toBeInTheDocument();

    act(() => useStore.getState().toggleVisible(id)); // hidden items don't count
    expect(rowNames()).toEqual(['X', 'Y', 'Z']);
  });

  it('hides the More button when every diagonal is already shown', () => {
    const id = useStore.getState().addItem();
    for (const d of ['ne', 'nw', 'une', 'unw'] as const) useStore.getState().setValue(id, d, 1);
    render(<AxisKey />);
    expect(rowNames()).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /more/i })).toBeNull();
  });
});

describe('grid opacity slider', () => {
  it('sits in the key header and sets the grid opacity (0–100%)', () => {
    render(<AxisKey />);
    const slider = screen.getByRole('slider', { name: 'Grid opacity' });
    expect(slider).toHaveValue('100');
    fireEvent.change(slider, { target: { value: '35' } });
    expect(useStore.getState().view.gridOpacity).toBeCloseTo(0.35);
    fireEvent.change(slider, { target: { value: '0' } });
    expect(useStore.getState().view.gridOpacity).toBe(0);
  });
});
