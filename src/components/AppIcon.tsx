import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "plus"
  | "settings"
  | "search"
  | "bell"
  | "calendar"
  | "inbox"
  | "pin"
  | "users"
  | "hash"
  | "voice"
  | "phone"
  | "camera"
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
  | "logout"
  | "live"
  | "refresh";

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
  calendar: "iconix-calendar",
  inbox: "iconix-inbox",
  pin: "iconix-pin",
  users: "iconix-users",
  hash: "iconix-hash",
  voice: "iconix-voice",
  phone: "iconix-phone",
  camera: "iconix-camera",
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
  live: "iconix-live",
  refresh: "iconix-refresh",
};

const ICONIX_SPRITE_URL = `${import.meta.env.BASE_URL}icons/iconix.svg?v=phone-camera-1`;

/** Inline fallbacks for icons that must render even if the sprite cache is stale. */
const INLINE_ICON_PATHS: Partial<Record<IconName, string>> = {
  phone: "M8.05 3.75h2.18c.7 0 1.3.5 1.44 1.18l.7 3.4c.12.6-.1 1.2-.56 1.56l-1.55 1.2a12.06 12.06 0 0 0 5.05 5.05l1.2-1.55c.36-.46.96-.68 1.56-.56l3.4.7c.68.14 1.18.74 1.18 1.44v2.06c0 1.7-1.42 3.07-3.12 2.95A16.75 16.75 0 0 1 3.8 6.87c-.12-1.7 1.25-3.12 2.95-3.12Z",
  camera: "M3.75 7.5A2.25 2.25 0 0 1 6 5.25h7.5A2.25 2.25 0 0 1 15.75 7.5v9A2.25 2.25 0 0 1 13.5 18.75H6A2.25 2.25 0 0 1 3.75 16.5v-9ZM15.75 10.2 20.25 7.5v9l-4.5-2.7V10.2Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  calendar: "M7.5 3.75v1.5m9-1.5v1.5M4.5 9h15M6 5.25h12A1.5 1.5 0 0 1 19.5 6.75v12A1.5 1.5 0 0 1 18 20.25H6A1.5 1.5 0 0 1 4.5 18.75v-12A1.5 1.5 0 0 1 6 5.25Zm2.25 7.5h.008v.008H8.25V12.75Zm3.75 0h.008v.008H12V12.75Zm3.75 0h.008v.008h-.008V12.75Zm-7.5 3.75h.008v.008H8.25v-.008Zm3.75 0h.008v.008H12v-.008Zm3.75 0h.008v.008h-.008v-.008Z",
  live: "M4.5 7.5A2.25 2.25 0 0 1 6.75 5.25h7.5A2.25 2.25 0 0 1 16.5 7.5v6A2.25 2.25 0 0 1 14.25 15.75h-7.5A2.25 2.25 0 0 1 4.5 13.5v-6Zm14.25 1.05 3 1.8v3.9l-3 1.8V8.55ZM18.75 5.25a1.125 1.125 0 1 1 0 2.25 1.125 1.125 0 0 1 0-2.25Z",
  refresh: "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182",
};

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
  const inlinePath = INLINE_ICON_PATHS[name];
  const strokeWidth = name === "more" ? "2.25" : "1.5";

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
      {inlinePath ? (
        <path d={inlinePath} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <use href={`${ICONIX_SPRITE_URL}#${ICON_SYMBOLS[name]}`} />
      )}
    </svg>
  );
}
