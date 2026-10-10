import { z } from 'zod';

export const STEP_MIN = -5;
export const STEP_MAX = 5;

export const AXIS_IDS = ['x', 'y', 'z'] as const;
/** 45° compass diagonals: floor NE/NW, and up-diagonals between Y and each. */
export const DIAGONAL_IDS = ['ne', 'nw', 'une', 'unw'] as const;
/** Every axis an item has a value (one slider) for. */
export const ALL_AXIS_IDS = [...AXIS_IDS, ...DIAGONAL_IDS] as const;
export const PLANE_IDS = ['xy', 'xz', 'yz'] as const;
/** Compass planes (XY and YZ rotated 45° about Y); shown only while one of their diagonals is in use. */
export const DIAGONAL_PLANE_IDS = ['ne-y', 'nw-y'] as const;
export const ISOLATE_PLANES = [...PLANE_IDS, ...DIAGONAL_PLANE_IDS] as const;
export const PRESETS = ['front', 'top', 'side', 'iso'] as const;
export const VIEW_MODES = ['free', 'vectors', 'preset', 'isolate'] as const;
/** Independent on/off overlays, toggled from the Modes menu. */
export const MODE_IDS = ['person', 'push', 'single', 'result'] as const;

/** Radius of the person sphere; also the gap inserted between the origin and step ±1. */
export const PERSON_RADIUS = 1;

export const NAME_MAX = 24;
export const DESCRIPTION_MAX = 500;
export const AXIS_LABEL_MAX = 16;
export const SESSION_NAME_MAX = 60;
export const USERNAME_MIN = 3;
/** Long enough for any email address. */
export const USERNAME_MAX = 254;
export const PASSWORD_MIN = 8;

/**
 * Usernames allow letters, numbers, and _ . - @ + so an email address works (passwords have no
 * character limits). Returns why one is invalid, naming the first offending character, or null.
 */
export function usernameProblem(raw: string): string | null {
  const name = raw.trim();
  const bad = [...name].find((c) => !/[A-Za-z0-9_.\-@+]/.test(c));
  if (bad !== undefined) {
    const shown = bad === ' ' ? 'Spaces' : `"${bad}"`;
    return `${shown} can't be used in a username. Use letters, numbers, _ . - @ + (an email address works).`;
  }
  if (name.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters.`;
  if (name.length > USERNAME_MAX) return `Username must be at most ${USERNAME_MAX} characters.`;
  return null;
}

/** How a username is shown to other people: an email address loses its domain so it isn't exposed. */
export function publicName(username: string): string {
  const at = username.indexOf('@');
  return at > 0 ? username.slice(0, at) : username;
}

export type AxisId = (typeof AXIS_IDS)[number];
export type DiagonalId = (typeof DIAGONAL_IDS)[number];
export type AnyAxisId = (typeof ALL_AXIS_IDS)[number];
export type PlaneId = (typeof PLANE_IDS)[number];
export type DiagonalPlaneId = (typeof DIAGONAL_PLANE_IDS)[number];
export type IsolatePlane = (typeof ISOLATE_PLANES)[number];
export type Preset = (typeof PRESETS)[number];
export type ViewMode = (typeof VIEW_MODES)[number];
export type ModeId = (typeof MODE_IDS)[number];

/** Modes that only make sense with others on: enabling turns these on, disabling them turns it off. */
export const MODE_REQUIRES: Partial<Record<ModeId, ModeId[]>> = { push: ['person'], result: ['person'] };

export const PALETTE = [
  '#e4572e', '#2e86de', '#29a36a', '#f2a541', '#9b59b6', '#17becf',
  '#d63384', '#8c6d31', '#5c7cfa', '#e67e22', '#20c997', '#6c757d',
];

const step = z.number().int().min(STEP_MIN).max(STEP_MAX);

export const DEFAULT_VALUES = { x: 0, y: 0, z: 0, ne: 0, nw: 0, une: 0, unw: 0 } as const satisfies Record<
  AnyAxisId,
  number
>;

/**
 * Items used to store a 2D point per plane (so X, Y and Z each had two values) plus optional
 * diagonals. Convert those to one value per axis: if only one of an axis's two values is non-zero
 * it wins, otherwise they're averaged.
 */
function migrateLegacyItem(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || 'values' in raw || !('points' in raw)) return raw;
  const { points, diagonals, ...rest } = raw as {
    points?: Record<'xy' | 'xz' | 'yz', { a: number; b: number } | undefined>;
    diagonals?: Record<string, number>;
  };
  const merge = (a?: number, b?: number) =>
    a === undefined || b === undefined ? NaN : a === 0 ? b : b === 0 ? a : Math.round((a + b) / 2);
  return {
    ...rest,
    values: {
      ...DEFAULT_VALUES,
      x: merge(points?.xy?.a, points?.xz?.a),
      y: merge(points?.xy?.b, points?.yz?.a),
      z: merge(points?.xz?.b, points?.yz?.b),
      ...diagonals,
    },
  };
}

export const lineItemSchema = z.preprocess(
  migrateLegacyItem,
  z.object({
    id: z.string().min(1),
    name: z.string().max(NAME_MAX),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    description: z.string().max(DESCRIPTION_MAX),
    visible: z.boolean(),
    /** One slider value per axis, −5..5, 0 (the middle) by default. */
    values: z.object({ x: step, y: step, z: step, ne: step, nw: step, une: step, unw: step }),
  }),
);

const axisLabel = z.object({
  name: z.string().max(AXIS_LABEL_MAX),
  negLabel: z.string().max(AXIS_LABEL_MAX),
  posLabel: z.string().max(AXIS_LABEL_MAX),
});

type AxisLabelShape = z.infer<typeof axisLabel>;

const DEFAULT_DIAGONAL_LABELS: Record<DiagonalId, AxisLabelShape> = {
  ne: { name: 'NE', negLabel: '−NE', posLabel: '+NE' },
  nw: { name: 'NW', negLabel: '−NW', posLabel: '+NW' },
  une: { name: 'Up-NE', negLabel: '−Up-NE', posLabel: '+Up-NE' },
  unw: { name: 'Up-NW', negLabel: '−Up-NW', posLabel: '+Up-NW' },
};

export const axesSchema = z.object({
  x: axisLabel,
  y: axisLabel,
  z: axisLabel,
  // Added with the diagonals; defaults keep older saves/exports valid.
  ne: axisLabel.default(DEFAULT_DIAGONAL_LABELS.ne),
  nw: axisLabel.default(DEFAULT_DIAGONAL_LABELS.nw),
  une: axisLabel.default(DEFAULT_DIAGONAL_LABELS.une),
  unw: axisLabel.default(DEFAULT_DIAGONAL_LABELS.unw),
});

export const viewSchema = z.object({
  mode: z.enum(VIEW_MODES),
  preset: z.enum(PRESETS),
  isolatePlane: z.enum(ISOLATE_PLANES),
  /** Opacity multiplier for grid planes (0 hides them); axes are unaffected. */
  gridOpacity: z.number().min(0).max(1).default(1),
});

// Modes and the person entity were added after v1 shipped; defaults keep older saves/exports valid.
export const modesSchema = z.object({
  person: z.boolean().default(false),
  push: z.boolean().default(false),
  single: z.boolean().default(false),
  result: z.boolean().default(false),
});

/** World-space position of the person sphere (kept in state so it can be moved later). */
export const personSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
});

/** The persisted / exported portion of app state. */
export const documentSchema = z.object({
  items: z.array(lineItemSchema),
  axes: axesSchema,
  view: viewSchema,
  modes: modesSchema.default({}),
  person: personSchema.default({}),
});

/** Version 2: one value per axis. Version 1 files (per-plane points) are migrated on import. */
export const EXPORT_VERSION = 2;

/**
 * A Vectorizor Session: everything needed to re-create one (key labels, line items, and the view
 * they were last shown in). Exports, imports and saved sessions all use this shape.
 */
export const exportFileSchema = z.object({
  app: z.literal('vectorizor'),
  version: z.union([z.literal(1), z.literal(EXPORT_VERSION)]),
  /** Added with saved sessions; older exports have no name. */
  name: z.string().max(SESSION_NAME_MAX).optional(),
  data: documentSchema,
});

export type SessionFile = z.infer<typeof exportFileSchema>;

export function toSessionFile(name: string, data: AppDocument): SessionFile {
  return { app: 'vectorizor', version: EXPORT_VERSION, name, data };
}

export type PlanePoint = { a: number; b: number };
export type LineItem = z.infer<typeof lineItemSchema>;
export type AxisValues = LineItem['values'];
export type AxisLabel = AxisLabelShape;
export type Axes = z.infer<typeof axesSchema>;
export type ViewState = z.infer<typeof viewSchema>;
export type Modes = z.infer<typeof modesSchema>;
export type Person = z.infer<typeof personSchema>;
export type AppDocument = z.infer<typeof documentSchema>;

export const DEFAULT_AXES: Axes = {
  x: { name: 'X', negLabel: '−X', posLabel: '+X' },
  y: { name: 'Y', negLabel: '−Y', posLabel: '+Y' },
  z: { name: 'Z', negLabel: '−Z', posLabel: '+Z' },
  ...DEFAULT_DIAGONAL_LABELS,
};

export const DEFAULT_VIEW: ViewState = { mode: 'free', preset: 'iso', isolatePlane: 'xy', gridOpacity: 1 };

export const DEFAULT_MODES: Modes = { person: false, push: false, single: false, result: false };

export const DEFAULT_PERSON: Person = { position: [0, 0, 0] };

export function clampStep(n: number): number {
  return Math.max(STEP_MIN, Math.min(STEP_MAX, Math.round(n)));
}
