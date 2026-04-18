// Public types for OverlayController action shapes. Kept dependency-free so
// this module is safe to import from anywhere in the package.

export type CursorPosition = {
  x: number;
  y: number;
};

export type OverlayActionResult = CursorPosition | null | void;

export type OverlayActionOptions = {
  label?: string;
  resolveActionPosition?: () => Promise<CursorPosition | null>;
  showClickRipple?: boolean;
};

export type ScrollDelta = number | { x?: number; y?: number };

export type NormalizedScrollDelta = {
  x: number;
  y: number;
};

export type SelectOptionDescriptor = {
  value?: string;
  label?: string;
  index?: number;
};

export type SelectOptionValue =
  | string
  | readonly string[]
  | SelectOptionDescriptor
  | readonly SelectOptionDescriptor[]
  | null;
