import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  DEFAULT_AXES,
  DEFAULT_MODES,
  DEFAULT_PERSON,
  DEFAULT_VALUES,
  DEFAULT_VIEW,
  MODE_IDS,
  MODE_REQUIRES,
  PALETTE,
  PERSON_RADIUS,
  STEP_MAX,
  clampStep,
  documentSchema,
  type AnyAxisId,
  type AppDocument,
  type AxisLabel,
  type Axes,
  type IsolatePlane,
  type LineItem,
  type ModeId,
  type Person,
  type Preset,
  type ViewMode,
} from './schema';
import { activeCompassPlanes, resultant } from '../lib/coords';

export const STORAGE_KEY = 'vectorizor:v1';

interface UiState {
  expandedId: string | null;
  selectedId: string | null;
  keyEditing: boolean;
  /** Bumped to ask the camera to re-run a preset / reset. */
  cameraNonce: number;
}

interface Actions {
  addItem: () => string;
  updateItem: (id: string, patch: Partial<Pick<LineItem, 'name' | 'color' | 'description'>>) => void;
  /** Set one axis slider (clamped to −5..5 integers). */
  setValue: (id: string, axis: AnyAxisId, value: number) => void;
  toggleVisible: (id: string) => void;
  deleteItem: (id: string) => void;
  /** Expand a row (or collapse with null). Expanding also selects. */
  setExpanded: (id: string | null) => void;
  /** Select from the graph: highlights and expands the row; null clears selection. */
  select: (id: string | null) => void;
  setAxes: (axes: Axes) => void;
  setAxisLabel: (axis: AnyAxisId, patch: Partial<AxisLabel>) => void;
  setKeyEditing: (editing: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  /** 0..1, clamped. */
  setGridOpacity: (opacity: number) => void;
  setPreset: (preset: Preset) => void;
  setIsolatePlane: (plane: IsolatePlane) => void;
  resetCamera: () => void;
  toggleMode: (mode: ModeId) => void;
  setPersonPosition: (position: Person['position']) => void;
  replaceDocument: (doc: AppDocument) => void;
}

export type AppState = AppDocument & { ui: UiState } & Actions;

const initialUi: UiState = { expandedId: null, selectedId: null, keyEditing: false, cameraNonce: 0 };

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function nextColor(items: LineItem[]): string {
  const used = new Set(items.map((i) => i.color.toLowerCase()));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[items.length % PALETTE.length];
}

function nextName(items: LineItem[]): string {
  const names = new Set(items.map((i) => i.name));
  let n = items.length + 1;
  while (names.has(`Item ${n}`)) n++;
  return `Item ${n}`;
}

export function createItem(items: LineItem[]): LineItem {
  return {
    id: newId(),
    name: nextName(items),
    color: nextColor(items),
    description: '',
    visible: true,
    values: { ...DEFAULT_VALUES },
  };
}

/**
 * Set when the draft was recovered from localStorage, where it lived before sessions existed, so
 * the UI can point out that it hasn't been saved.
 */
export let restoredLegacyDraft = false;

/**
 * sessionStorage wrapper that coalesces rapid writes (e.g. slider drags). Per-tab storage means a
 * reload keeps the working session but a fresh visit starts empty.
 */
function throttledStorage(delayMs = 250): StateStorage {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    for (const [k, v] of pending) {
      try {
        sessionStorage.setItem(k, v);
      } catch {
        // storage full or blocked; ignore
      }
    }
    pending.clear();
  };
  const takeLegacy = (k: string) => {
    const v = localStorage.getItem(k);
    if (v !== null) {
      localStorage.removeItem(k);
      restoredLegacyDraft = true;
    }
    return v;
  };
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', flush);
  return {
    getItem: (k) => {
      try {
        return pending.get(k) ?? sessionStorage.getItem(k) ?? takeLegacy(k);
      } catch {
        return null;
      }
    },
    setItem: (k, v) => {
      pending.set(k, v);
      if (!timer) timer = setTimeout(flush, delayMs);
    },
    removeItem: (k) => {
      pending.delete(k);
      try {
        sessionStorage.removeItem(k);
      } catch {
        // ignore
      }
    },
  };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      items: [],
      axes: DEFAULT_AXES,
      view: DEFAULT_VIEW,
      modes: DEFAULT_MODES,
      person: DEFAULT_PERSON,
      ui: initialUi,

      addItem: () => {
        const item = createItem(get().items);
        set((s) => ({
          items: [...s.items, item],
          ui: { ...s.ui, expandedId: item.id, selectedId: item.id },
        }));
        return item.id;
      },

      updateItem: (id, patch) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),

      setValue: (id, axis, value) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, values: { ...i.values, [axis]: clampStep(value) } } : i)),
        })),

      toggleVisible: (id) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, visible: !i.visible } : i)) })),

      deleteItem: (id) =>
        set((s) => ({
          items: s.items.filter((i) => i.id !== id),
          ui: {
            ...s.ui,
            expandedId: s.ui.expandedId === id ? null : s.ui.expandedId,
            selectedId: s.ui.selectedId === id ? null : s.ui.selectedId,
          },
        })),

      setExpanded: (id) =>
        set((s) => ({ ui: { ...s.ui, expandedId: id, selectedId: id ?? s.ui.selectedId } })),

      select: (id) =>
        set((s) => ({
          ui: { ...s.ui, selectedId: id, expandedId: id ?? s.ui.expandedId },
        })),

      setAxes: (axes) => set({ axes }),

      setAxisLabel: (axis, patch) =>
        set((s) => ({ axes: { ...s.axes, [axis]: { ...s.axes[axis], ...patch } } })),

      setKeyEditing: (keyEditing) => set((s) => ({ ui: { ...s.ui, keyEditing } })),

      setViewMode: (mode) => set((s) => ({ view: { ...s.view, mode } })),

      setGridOpacity: (opacity) =>
        set((s) => ({ view: { ...s.view, gridOpacity: Math.max(0, Math.min(1, opacity)) } })),

      setPreset: (preset) =>
        set((s) => ({
          view: { ...s.view, mode: 'preset', preset },
          ui: { ...s.ui, cameraNonce: s.ui.cameraNonce + 1 },
        })),

      setIsolatePlane: (isolatePlane) =>
        set((s) => ({ view: { ...s.view, mode: 'isolate', isolatePlane } })),

      resetCamera: () => set((s) => ({ ui: { ...s.ui, cameraNonce: s.ui.cameraNonce + 1 } })),

      toggleMode: (mode) =>
        set((s) => {
          const on = !s.modes[mode];
          const modes = { ...s.modes, [mode]: on };
          // Keep dependencies consistent: on pulls in what it needs, off drops what needs it.
          if (on) for (const r of MODE_REQUIRES[mode] ?? []) modes[r] = true;
          else for (const m of MODE_IDS) if (MODE_REQUIRES[m]?.includes(mode)) modes[m] = false;
          return { modes };
        }),

      setPersonPosition: (position) => set((s) => ({ person: { ...s.person, position } })),

      replaceDocument: (doc) =>
        set((s) => ({
          items: doc.items,
          axes: doc.axes,
          view: doc.view,
          modes: doc.modes,
          person: doc.person,
          ui: { ...initialUi, cameraNonce: s.ui.cameraNonce + 1 },
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => throttledStorage()),
      partialize: (s) => ({ items: s.items, axes: s.axes, view: s.view, modes: s.modes, person: s.person }),
      merge: (persisted, current) => {
        const parsed = documentSchema.safeParse(persisted);
        if (!parsed.success) return current;
        return { ...current, ...parsed.data };
      },
    },
  ),
);

export const EMPTY_DOCUMENT: AppDocument = {
  items: [],
  axes: DEFAULT_AXES,
  view: DEFAULT_VIEW,
  modes: DEFAULT_MODES,
  person: DEFAULT_PERSON,
};

export function getDocument(): AppDocument {
  const { items, axes, view, modes, person } = useStore.getState();
  return { items, axes, view, modes, person };
}

/** World-space gap between the origin and step ±1: room for the person sphere when it's shown. */
export const selectAxisGap = (s: AppState): number => (s.modes.person ? PERSON_RADIUS : 0);

/**
 * Grid half-size in steps. Single mode's resultants can reach ~±17 per axis once the diagonals add
 * in, so the grid grows to fit the largest visible one, in multiples of 5 and never below ±5.
 */
export const selectGridSteps = (s: AppState): number => {
  if (!s.modes.single) return STEP_MAX;
  const largest = Math.max(0, ...s.items.filter((i) => i.visible).flatMap((i) => resultant(i).map(Math.abs)));
  // Small epsilon so float noise (e.g. 10.0000000001) doesn't bump the grid up a size.
  return Math.max(STEP_MAX, Math.ceil(largest / STEP_MAX - 1e-9) * STEP_MAX);
};

/** The isolated plane, falling back to XY if it's a compass plane that isn't currently shown. */
export const selectIsolatePlane = (s: AppState): IsolatePlane => {
  const plane = s.view.isolatePlane;
  if (plane !== 'ne-y' && plane !== 'nw-y') return plane;
  return activeCompassPlanes(s.items).includes(plane) ? plane : 'xy';
};
