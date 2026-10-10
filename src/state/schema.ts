import { z } from 'zod';

export const STEP_MIN = -5;
export const STEP_MAX = 5;

export const AXIS_IDS = ['x', 'y', 'z'] as const;
export const PLANE_IDS = ['xy', 'xz', 'yz'] as const;
export const PRESETS = ['front', 'top', 'side', 'iso'] as const;
export const VIEW_MODES = ['free', 'vectors', 'preset', 'isolate'] as const;
/** Independent on/off overlays, toggled from the Modes menu. */
export const MODE_IDS = ['person', 'push', 'single'] as const;

/** Radius of the person sphere; also the gap inserted between the origin and step ±1. */
export const PERSON_RADIUS = 1;

export const NAME_MAX = 24;
export const DESCRIPTION_MAX = 500;
export const AXIS_LABEL_MAX = 16;

export type AxisId = (typeof AXIS_IDS)[number];
export type PlaneId = (typeof PLANE_IDS)[number];
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
});

const axisLabel = z.object({
  name: z.string().max(AXIS_LABEL_MAX),
  negLabel: z.string().max(AXIS_LABEL_MAX),
  posLabel: z.string().max(AXIS_LABEL_MAX),
});

export const axesSchema = z.object({ x: axisLabel, y: axisLabel, z: axisLabel });

export const viewSchema = z.object({
  mode: z.enum(VIEW_MODES),
  preset: z.enum(PRESETS),
  isolatePlane: z.enum(PLANE_IDS),
});

// Modes and the person entity were added after v1 shipped; defaults keep older saves/exports valid.
export const modesSchema = z.object({
  person: z.boolean().default(false),
  push: z.boolean().default(false),
  single: z.boolean().default(false),
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
export type AxisLabel = z.infer<typeof axisLabel>;
export type Axes = z.infer<typeof axesSchema>;
export type ViewState = z.infer<typeof viewSchema>;
export type Modes = z.infer<typeof modesSchema>;
export type Person = z.infer<typeof personSchema>;
export type AppDocument = z.infer<typeof documentSchema>;

export const DEFAULT_AXES: Axes = {
  x: { name: 'X', negLabel: '−X', posLabel: '+X' },
  y: { name: 'Y', negLabel: '−Y', posLabel: '+Y' },
  z: { name: 'Z', negLabel: '−Z', posLabel: '+Z' },
};

export const DEFAULT_VIEW: ViewState = { mode: 'free', preset: 'iso', isolatePlane: 'xy' };

export const DEFAULT_MODES: Modes = { person: false, push: false, single: false };

export const DEFAULT_PERSON: Person = { position: [0, 0, 0] };

export function clampStep(n: number): number {
  return Math.max(STEP_MIN, Math.min(STEP_MAX, Math.round(n)));
}
