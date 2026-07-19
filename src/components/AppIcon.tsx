import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "plus"
  | "settings"
  | "search"
  | "bell"
  | "inbox"
  | "pin"
  | "users"
  | "hash"
  | "voice"
  | "lock"
  | "chevronDown"
  | "chevronRight"
  | "send"
  | "image"
  | "smile"
  | "eye"
  | "more"
  | "reply"
  | "edit"
  | "trash"
  | "close"
  | "minimize"
  | "maximize"
  | "user"
  | "microphone"
  | "headphones"
  | "paperclip"
  | "sun"
  | "moon"
  | "play"
  | "pause"
  | "volume"
  | "volumeOff"
  | "logout";

export const ICON_SIZES = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
} as const;

export type IconSize = keyof typeof ICON_SIZES;

export const APP_ICON_SYSTEM = {
  name: "Iconix",
  creator: "Rijal",
  source:
    "https://www.figma.com/design/89xytB3wWa8vYnVIGFXXZP/Iconix-by-Rijal--Community-?node-id=0-1",
  viewBox: "0 0 24 24",
  strokeWidth: 1.5,
} as const;

const ICON_SYMBOLS: Record<IconName, string> = {
  home: "iconix-home",
  plus: "iconix-plus",
  settings: "iconix-settings",
  search: "iconix-search",
  bell: "iconix-bell",
  inbox: "iconix-inbox",
  pin: "iconix-pin",
  users: "iconix-users",
  hash: "iconix-hash",
  voice: "iconix-voice",
  lock: "iconix-lock",
  chevronDown: "iconix-chevron-down",
  chevronRight: "iconix-chevron-right",
  send: "iconix-send",
  image: "iconix-image",
  smile: "iconix-smile",
  eye: "iconix-eye",
  more: "iconix-more",
  reply: "iconix-reply",
  edit: "iconix-edit",
  trash: "iconix-trash",
  close: "iconix-close",
  minimize: "iconix-minimize",
  maximize: "iconix-maximize",
  user: "iconix-user",
  microphone: "iconix-microphone",
  headphones: "iconix-headphones",
  paperclip: "iconix-paperclip",
  sun: "iconix-sun",
  moon: "iconix-moon",
  play: "iconix-play",
  pause: "iconix-pause",
  volume: "iconix-volume",
  volumeOff: "iconix-volume-off",
  logout: "iconix-logout",
};

const ICONIX_SPRITE_URL = `${import.meta.env.BASE_URL}icons/iconix.svg`;

export type AppIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  name: IconName;
  size?: IconSize | number;
  title?: string;
};

/**
 * The single Picom UI icon boundary. Iconix vectors inherit `currentColor`, so
 * components control muted, hover, active and semantic states with tokens.
 */
export function AppIcon({
  name,
  size = "md",
  title,
  ...svgProps
}: AppIconProps) {
  const pixelSize = typeof size === "number" ? size : ICON_SIZES[size];
  const ariaLabel = svgProps["aria-label"] ?? title;

  return (
    <svg
      {...svgProps}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      data-icon={name}
      data-icon-set="iconix"
      fill="none"
      focusable="false"
      height={pixelSize}
      role={ariaLabel ? (svgProps.role ?? "img") : svgProps.role}
      viewBox="0 0 24 24"
      width={pixelSize}
    >
      {title ? <title>{title}</title> : null}
      <use href={`${ICONIX_SPRITE_URL}#${ICON_SYMBOLS[name]}`} />
    </svg>
  );
}
