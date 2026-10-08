import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import {
  DEFAULT_AXES,
  DEFAULT_VIEW,
  PALETTE,
  clampStep,
  documentSchema,
  type AppDocument,
  type AxisId,
  type AxisLabel,
  type Axes,
  type LineItem,
  type PlaneId,
  type Preset,
  type ViewMode,
} from './schema';

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
  setPoint: (id: string, plane: PlaneId, key: 'a' | 'b', value: number) => void;
  toggleVisible: (id: string) => void;
  deleteItem: (id: string) => void;
  /** Expand a row (or collapse with null). Expanding also selects. */
  setExpanded: (id: string | null) => void;
  /** Select from the graph: highlights and expands the row; null clears selection. */
  select: (id: string | null) => void;
  setAxes: (axes: Axes) => void;
  setAxisLabel: (axis: AxisId, patch: Partial<AxisLabel>) => void;
  setKeyEditing: (editing: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setPreset: (preset: Preset) => void;
  setIsolatePlane: (plane: PlaneId) => void;
  resetCamera: () => void;
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
    points: { xy: { a: 0, b: 0 }, xz: { a: 0, b: 0 }, yz: { a: 0, b: 0 } },
  };
}

/** localStorage wrapper that coalesces rapid writes (e.g. slider drags). */
function throttledStorage(delayMs = 250): StateStorage {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    for (const [k, v] of pending) {
      try {
        localStorage.setItem(k, v);
      } catch {
        // storage full or blocked; ignore
      }
    }
    pending.clear();
  };
  if (typeof window !== 'undefined') window.addEventListener('beforeunload', flush);
  return {
    getItem: (k) => {
      try {
        return pending.get(k) ?? localStorage.getItem(k);
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
        localStorage.removeItem(k);
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

      setPoint: (id, plane, key, value) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? { ...i, points: { ...i.points, [plane]: { ...i.points[plane], [key]: clampStep(value) } } }
              : i,
          ),
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

      setPreset: (preset) =>
        set((s) => ({
          view: { ...s.view, mode: 'preset', preset },
          ui: { ...s.ui, cameraNonce: s.ui.cameraNonce + 1 },
        })),

      setIsolatePlane: (isolatePlane) =>
        set((s) => ({ view: { ...s.view, mode: 'isolate', isolatePlane } })),

      resetCamera: () => set((s) => ({ ui: { ...s.ui, cameraNonce: s.ui.cameraNonce + 1 } })),

      replaceDocument: (doc) =>
        set((s) => ({
          items: doc.items,
          axes: doc.axes,
          view: doc.view,
          ui: { ...initialUi, cameraNonce: s.ui.cameraNonce + 1 },
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => throttledStorage()),
      partialize: (s) => ({ items: s.items, axes: s.axes, view: s.view }),
      merge: (persisted, current) => {
        const parsed = documentSchema.safeParse(persisted);
        if (!parsed.success) return current;
        return { ...current, ...parsed.data };
      },
    },
  ),
);

export function getDocument(): AppDocument {
  const { items, axes, view } = useStore.getState();
  return { items, axes, view };
}
