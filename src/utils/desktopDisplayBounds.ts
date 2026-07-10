export type OverlayBoundsInput = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  margin?: number;
}>;

export type OverlayPosition = Readonly<{ left: number; top: number }>;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clampOverlayPosition(input: OverlayBoundsInput): OverlayPosition {
  const margin = Math.max(0, finiteOr(input.margin ?? 16, 16));
  const viewportWidth = Math.max(0, finiteOr(input.viewportWidth, 0));
  const viewportHeight = Math.max(0, finiteOr(input.viewportHeight, 0));
  const width = Math.max(0, finiteOr(input.width, 0));
  const height = Math.max(0, finiteOr(input.height, 0));
  const maxLeft = Math.max(margin, viewportWidth - width - margin);
  const maxTop = Math.max(margin, viewportHeight - height - margin);
  return {
    left: Math.min(Math.max(finiteOr(input.x, margin), margin), maxLeft),
    top: Math.min(Math.max(finiteOr(input.y, margin), margin), maxTop),
  };
}
