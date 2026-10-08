import { fireEvent, render, screen } from '@testing-library/react';
import ListSection from '../src/components/list/ListSection';
import { useStore } from '../src/state/store';
import { DEFAULT_AXES, DEFAULT_VIEW } from '../src/state/schema';

beforeEach(() =>
  useStore.setState({
    items: [],
    axes: DEFAULT_AXES,
    view: DEFAULT_VIEW,
    ui: { expandedId: null, selectedId: null, keyEditing: false, cameraNonce: 0 },
  }),
);

describe('list section', () => {
  it('adds an item, expands it with 6 centered sliders, and updates the store', () => {
    render(<ListSection />);
    fireEvent.click(screen.getByRole('button', { name: /add new item/i }));

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(6);
    sliders.forEach((s) => expect(s).toHaveValue('0'));

    fireEvent.change(screen.getByLabelText('XZ plane Z'), { target: { value: '4' } });
    expect(useStore.getState().items[0].points.xz.b).toBe(4);

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
