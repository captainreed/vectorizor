import { z } from 'zod';

export const STEP_MIN = -5;
export const STEP_MAX = 5;

export const AXIS_IDS = ['x', 'y', 'z'] as const;
export const PLANE_IDS = ['xy', 'xz', 'yz'] as const;
export const PRESETS = ['front', 'top', 'side', 'iso'] as const;
export const VIEW_MODES = ['free', 'vectors', 'preset', 'isolate'] as const;

export const NAME_MAX = 24;
export const DESCRIPTION_MAX = 500;
export const AXIS_LABEL_MAX = 16;

export type AxisId = (typeof AXIS_IDS)[number];
export type PlaneId = (typeof PLANE_IDS)[number];
export type Preset = (typeof PRESETS)[number];
export type ViewMode = (typeof VIEW_MODES)[number];

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

/** The persisted / exported portion of app state. */
export const documentSchema = z.object({
  items: z.array(lineItemSchema),
  axes: axesSchema,
  view: viewSchema,
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
export type AppDocument = z.infer<typeof documentSchema>;

export const DEFAULT_AXES: Axes = {
  x: { name: 'X', negLabel: '−X', posLabel: '+X' },
  y: { name: 'Y', negLabel: '−Y', posLabel: '+Y' },
  z: { name: 'Z', negLabel: '−Z', posLabel: '+Z' },
};

export const DEFAULT_VIEW: ViewState = { mode: 'free', preset: 'iso', isolatePlane: 'xy' };

export function clampStep(n: number): number {
  return Math.max(STEP_MIN, Math.min(STEP_MAX, Math.round(n)));
}
