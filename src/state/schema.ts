import { z } from 'zod';

export const STEP_MIN = -5;
export const STEP_MAX = 5;

export const AXIS_IDS = ['x', 'y', 'z'] as const;
/** Compass mode: 45° diagonals (floor NE/NW, and up-diagonals between Y and each). One slider each. */
export const DIAGONAL_IDS = ['ne', 'nw', 'une', 'unw'] as const;
export const ALL_AXIS_IDS = [...AXIS_IDS, ...DIAGONAL_IDS] as const;
export const PLANE_IDS = ['xy', 'xz', 'yz'] as const;
/** Compass mode adds two vertical planes: XY and YZ rotated 45° about Y. */
export const DIAGONAL_PLANE_IDS = ['ne-y', 'nw-y'] as const;
export const ISOLATE_PLANES = [...PLANE_IDS, ...DIAGONAL_PLANE_IDS] as const;
export const PRESETS = ['front', 'top', 'side', 'iso'] as const;
export const VIEW_MODES = ['free', 'vectors', 'preset', 'isolate'] as const;
/** Independent on/off overlays, toggled from the Modes menu. */
export const MODE_IDS = ['person', 'push', 'single', 'compass'] as const;

/** Radius of the person sphere; also the gap inserted between the origin and step ±1. */
export const PERSON_RADIUS = 1;

export const NAME_MAX = 24;
export const DESCRIPTION_MAX = 500;
export const AXIS_LABEL_MAX = 16;

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
export const MODE_REQUIRES: Partial<Record<ModeId, ModeId[]>> = { push: ['person'] };

export const PALETTE = [
  '#e4572e', '#2e86de', '#29a36a', '#f2a541', '#9b59b6', '#17becf',
  '#d63384', '#8c6d31', '#5c7cfa', '#e67e22', '#20c997', '#6c757d',
];

const step = z.number().int().min(STEP_MIN).max(STEP_MAX);
const planePoint = z.object({ a: step, b: step });

export const lineItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(NAME_MAX),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  description: z.string().max(DESCRIPTION_MAX),
  visible: z.boolean(),
  points: z.object({ xy: planePoint, xz: planePoint, yz: planePoint }),
  // Added with Compass mode; default keeps older saves/exports valid.
  diagonals: z.object({ ne: step, nw: step, une: step, unw: step }).default({ ne: 0, nw: 0, une: 0, unw: 0 }),
});

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
  ne: axisLabel.default(DEFAULT_DIAGONAL_LABELS.ne),
  nw: axisLabel.default(DEFAULT_DIAGONAL_LABELS.nw),
  une: axisLabel.default(DEFAULT_DIAGONAL_LABELS.une),
  unw: axisLabel.default(DEFAULT_DIAGONAL_LABELS.unw),
});

export const viewSchema = z.object({
  mode: z.enum(VIEW_MODES),
  preset: z.enum(PRESETS),
  isolatePlane: z.enum(ISOLATE_PLANES),
});

// Modes and the person entity were added after v1 shipped; defaults keep older saves/exports valid.
export const modesSchema = z.object({
  person: z.boolean().default(false),
  push: z.boolean().default(false),
  single: z.boolean().default(false),
  compass: z.boolean().default(false),
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

export const exportFileSchema = z.object({
  app: z.literal('vectorizor'),
  version: z.literal(1),
  data: documentSchema,
});

export type PlanePoint = z.infer<typeof planePoint>;
export type LineItem = z.infer<typeof lineItemSchema>;
export type Diagonals = LineItem['diagonals'];
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

export const DEFAULT_DIAGONALS: Diagonals = { ne: 0, nw: 0, une: 0, unw: 0 };

export const DEFAULT_VIEW: ViewState = { mode: 'free', preset: 'iso', isolatePlane: 'xy' };

export const DEFAULT_MODES: Modes = { person: false, push: false, single: false, compass: false };

export const DEFAULT_PERSON: Person = { position: [0, 0, 0] };

export function clampStep(n: number): number {
  return Math.max(STEP_MIN, Math.min(STEP_MAX, Math.round(n)));
}
