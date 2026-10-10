import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabBar from '../src/components/TabBar';
import AxisKey from '../src/components/graph/AxisKey';
import { EMPTY_DOCUMENT, useStore } from '../src/state/store';
import { useSession } from '../src/state/session';

/** Pretend to be a phone (or not): jsdom has no matchMedia of its own. */
function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width: 700px'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  useStore.getState().replaceDocument(EMPTY_DOCUMENT);
  useSession.setState({ user: null, meta: null, name: '', dirty: false, busy: false, notice: null, dialog: null });
});

afterEach(() => {
  // @ts-expect-error restore jsdom's default (no matchMedia)
  delete window.matchMedia;
});

describe('phone layout', () => {
  beforeEach(() => setPhone(true));

  it('puts every control in one ☰ panel that opens and closes', async () => {
    render(<TabBar />);
    const burger = screen.getByRole('button', { name: 'Menu' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(burger);
    expect(burger).toHaveAttribute('aria-expanded', 'true');
    // Views and Modes are listed inline rather than behind their own dropdown buttons.
    expect(screen.getByRole('menu', { name: 'Views' })).toBeVisible();
    expect(screen.getByRole('menu', { name: 'Modes' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^views/i })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Vectors' })).toBeVisible();
    expect(screen.getByRole('button', { name: /sessions/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /share/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /log in/i })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    expect(burger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes after picking a view, but stays open while toggling modes', async () => {
    render(<TabBar />);
    const burger = screen.getByRole('button', { name: 'Menu' });
    await userEvent.click(burger);
    await userEvent.click(within(screen.getByRole('menu', { name: 'Modes' })).getByRole('menuitemcheckbox', { name: 'Person' }));
    expect(useStore.getState().modes.person).toBe(true);
    expect(burger).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Top (XZ)' }));
    expect(useStore.getState().view).toMatchObject({ mode: 'preset', preset: 'top' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when a dialog is opened from it', async () => {
    render(<TabBar />);
    const burger = screen.getByRole('button', { name: 'Menu' });
    await userEvent.click(burger);
    await userEvent.click(screen.getByRole('button', { name: /sessions/i }));
    expect(useSession.getState().dialog).toBe('sessions');
    expect(burger).toHaveAttribute('aria-expanded', 'false');
  });

  it('starts with the key hidden; tapping "Key" toggles it', async () => {
    render(<AxisKey />);
    expect(screen.queryByRole('region', { name: 'Axis key' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^Key/ }));
    expect(screen.getByRole('region', { name: 'Axis key' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /^Key/ }));
    expect(screen.queryByRole('region', { name: 'Axis key' })).toBeNull();
  });
});

describe('desktop layout', () => {
  beforeEach(() => setPhone(false));

  it('keeps the dropdowns and shows the key; "Key" hides it there too', async () => {
    render(
      <>
        <TabBar />
        <AxisKey />
      </>,
    );
    expect(screen.getByRole('button', { name: /^views/i })).toBeVisible();
    expect(screen.queryByRole('menu', { name: 'Views' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Axis key' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /^Key/ }));
    expect(screen.queryByRole('region', { name: 'Axis key' })).toBeNull();
  });
});
