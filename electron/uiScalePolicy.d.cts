export type AllowedInterfaceScale = 0.9 | 1 | 1.1 | 1.25;

export const ALLOWED_INTERFACE_SCALES: readonly AllowedInterfaceScale[];
export function isAllowedInterfaceScale(value: unknown): value is AllowedInterfaceScale;
export function normalizeInterfaceScale(value: unknown): AllowedInterfaceScale;
