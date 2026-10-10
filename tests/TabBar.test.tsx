import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabBar from '../src/components/TabBar';
import { EMPTY_DOCUMENT, useStore } from '../src/state/store';

beforeEach(() => useStore.getState().replaceDocument(EMPTY_DOCUMENT));

const openViews = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^views/i }));
  return screen.getByRole('menu', { name: 'Views' });
};

describe('views menu', () => {
  it('replaces the separate Presets and Isolate buttons', () => {
    render(<TabBar />);
    expect(screen.queryByRole('button', { name: /presets/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^isolate/i })).toBeNull();
  });

  it('lists each preset with an Isolate button for its plane (none for Isometric)', async () => {
    render(<TabBar />);
    const menu = await openViews();
    const rows = within(menu).getAllByRole('group');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual(['Front (XY)', 'Top (XZ)', 'Side (YZ)', 'Isometric']);
    expect(within(rows[0]).getByRole('menuitemradio', { name: 'Isolate XY plane' })).toBeVisible();
    expect(within(rows[1]).getByRole('menuitemradio', { name: 'Isolate XZ plane' })).toBeVisible();
    expect(within(rows[2]).getByRole('menuitemradio', { name: 'Isolate YZ plane' })).toBeVisible();
    expect(within(rows[3]).queryByRole('menuitemradio', { name: /isolate/i })).toBeNull();
  });

  it('preset buttons set the preset; Isolate buttons isolate the plane', async () => {
    render(<TabBar />);
    const nonce = useStore.getState().ui.cameraNonce;
    await userEvent.click(within(await openViews()).getByRole('menuitemradio', { name: 'Top (XZ)' }));
    expect(useStore.getState().view).toMatchObject({ mode: 'preset', preset: 'top' });
    expect(useStore.getState().ui.cameraNonce).toBe(nonce + 1);
    expect(screen.getByRole('button', { name: /views: top \(xz\)/i })).toBeVisible();

    await userEvent.click(within(await openViews()).getByRole('menuitemradio', { name: 'Isolate YZ plane' }));
    expect(useStore.getState().view).toMatchObject({ mode: 'isolate', isolatePlane: 'yz' });
    expect(screen.getByRole('button', { name: /views: isolate yz/i })).toBeVisible();
    expect(screen.queryByRole('menu', { name: 'Views' })).toBeNull();
  });

  it('adds Isolate-only rows for compass planes while a diagonal is in use', async () => {
    render(<TabBar />);
    expect(within(await openViews()).queryByRole('menuitemradio', { name: /NE–Y/ })).toBeNull();
    await userEvent.keyboard('{Escape}');
    const id = useStore.getState().addItem();
    useStore.getState().setValue(id, 'ne', 2);
    const row = within(await openViews()).getByRole('group', { name: 'NE–Y plane' });
    expect(within(row).getAllByRole('menuitemradio')).toHaveLength(1);
    await userEvent.click(within(row).getByRole('menuitemradio', { name: 'Isolate NE–Y plane' }));
    expect(useStore.getState().view).toMatchObject({ mode: 'isolate', isolatePlane: 'ne-y' });
  });
});

describe('Free 3D / Vectors toggle', () => {
  it('is one button that switches between dots only and vectors', async () => {
    render(<TabBar />);
    expect(screen.queryByRole('tab', { name: 'Free 3D' })).toBeNull();
    const toggle = screen.getByRole('switch', { name: 'Vectors' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(useStore.getState().view.vectors).toBe(true);
    await userEvent.click(toggle);
    expect(useStore.getState().view.vectors).toBe(false);
  });

  it('keeps vectors on when a preset or isolated plane is picked, and keeps the view when toggled', async () => {
    render(<TabBar />);
    const toggle = screen.getByRole('switch', { name: 'Vectors' });
    await userEvent.click(toggle);
    await userEvent.click(within(await openViews()).getByRole('menuitemradio', { name: 'Side (YZ)' }));
    expect(useStore.getState().view).toMatchObject({ mode: 'preset', preset: 'side', vectors: true });
    await userEvent.click(within(await openViews()).getByRole('menuitemradio', { name: 'Isolate XZ plane' }));
    expect(useStore.getState().view).toMatchObject({ mode: 'isolate', isolatePlane: 'xz', vectors: true });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(toggle);
    expect(useStore.getState().view).toMatchObject({ mode: 'isolate', isolatePlane: 'xz', vectors: false });
  });
});
