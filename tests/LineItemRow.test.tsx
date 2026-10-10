import { act, fireEvent, render, screen } from '@testing-library/react';
import ListSection from '../src/components/list/ListSection';
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

describe('list section', () => {
  it('adds an item, expands it with 7 centered sliders (one per axis), and updates the store', () => {
    render(<ListSection />);
    fireEvent.click(screen.getByRole('button', { name: /add new item/i }));

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(7);
    sliders.forEach((s) => expect(s).toHaveValue('0'));

    fireEvent.change(screen.getByLabelText('Z slider'), { target: { value: '4' } });
    expect(useStore.getState().items[0].values.z).toBe(4);
    fireEvent.change(screen.getByLabelText('Up-NE slider'), { target: { value: '-3' } });
    expect(useStore.getState().items[0].values.une).toBe(-3);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alpha' } });
    expect(useStore.getState().items[0].name).toBe('Alpha');
  });

  it('checkbox toggles visibility without expanding', () => {
    useStore.getState().addItem();
    useStore.getState().setExpanded(null);
    render(<ListSection />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(useStore.getState().items[0].visible).toBe(false);
    expect(screen.queryAllByRole('slider')).toHaveLength(0);
  });

  it('delete requires inline confirmation', () => {
    useStore.getState().addItem();
    render(<ListSection />);
    fireEvent.click(screen.getByRole('button', { name: /delete item 1/i }));
    expect(useStore.getState().items).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(useStore.getState().items).toHaveLength(0);
  });
});

describe('collapsed summary', () => {
  it('shows X/Y/Z, adds diagonals only once one is non-zero', () => {
    const id = useStore.getState().addItem();
    useStore.getState().setValue(id, 'x', 3);
    useStore.getState().setExpanded(null);
    render(<ListSection />);
    expect(screen.getByText('XYZ(3, 0, 0)')).toBeInTheDocument();
    expect(screen.queryByText(/^Diag/)).toBeNull();

    act(() => useStore.getState().setValue(id, 'nw', -2));
    expect(screen.getByText('Diag(0, −2, 0, 0)')).toBeInTheDocument();
  });
});
