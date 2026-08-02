import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function BaseIcon({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconOverview(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </BaseIcon>
  );
}

export function IconProfile(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.8-3.2 4.1-4.5 7-4.5s5.2 1.3 7 4.5" />
    </BaseIcon>
  );
}

export function IconMail(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m5 8 7 5 7-5" />
    </BaseIcon>
  );
}

export function IconBadge(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3.5 14.2 8l4.8.7-3.5 3.4.8 4.8L12 15.8 7.7 17l.8-4.8L5 8.7 9.8 8z" />
    </BaseIcon>
  );
}

export function IconShield(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3.5 19 6.5v5.2c0 4.2-2.8 7.4-7 8.8-4.2-1.4-7-4.6-7-8.8V6.5z" />
    </BaseIcon>
  );
}

export function IconKey(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="8" cy="14" r="3.5" />
      <path d="M11 12.5 20.5 3M16 5.5l2.5 2.5" />
    </BaseIcon>
  );
}

export function IconDevices(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="12" height="10" rx="1.5" />
      <path d="M7 19h4M9 15v4M17 9h2.5A1.5 1.5 0 0 1 21 10.5v7A1.5 1.5 0 0 1 19.5 19H15" />
    </BaseIcon>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h10M18 7h2M12 17h8M4 17h4M14 4v6M8 14v6" />
    </BaseIcon>
  );
}

export function IconBell(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6.5 16.5h11M7.5 16.5V11a4.5 4.5 0 1 1 9 0v5.5M10 19a2 2 0 0 0 4 0" />
    </BaseIcon>
  );
}

export function IconLock(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </BaseIcon>
  );
}

export function IconDatabase(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6" />
    </BaseIcon>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4.5 20.5 19h-17z" />
      <path d="M12 10v4M12 16.5h.01" />
    </BaseIcon>
  );
}

export function IconSupport(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.8 2.1c-.8.5-1.3 1-1.3 2M12 16.5h.01" />
    </BaseIcon>
  );
}

export function IconHome(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m4 11 8-7 8 7" />
      <path d="M7 10.5V19h10v-8.5" />
    </BaseIcon>
  );
}

export function IconSignOut(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 4.5H6.5A2.5 2.5 0 0 0 4 7v10a2.5 2.5 0 0 0 2.5 2.5H10M14 8l4 4-4 4M18 12H9" />
    </BaseIcon>
  );
}

export function IconSun(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v2M12 18.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3.5 12h2M18.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </BaseIcon>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 6.5 6.5 0 1 0 19 14.5z" />
    </BaseIcon>
  );
}

export function IconMonitor(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3.5" y="5" width="17" height="11" rx="2" />
      <path d="M8 19h8M12 16v3" />
    </BaseIcon>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </BaseIcon>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m14.5 6-5 6 5 6" />
    </BaseIcon>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m9.5 6 5 6-5 6" />
    </BaseIcon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m5.5 12.5 4 4 9-9" />
    </BaseIcon>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z" />
    </BaseIcon>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 5.5H6.5A2.5 2.5 0 0 0 4 8v9.5A2.5 2.5 0 0 0 6.5 20H16a2.5 2.5 0 0 0 2.5-2.5V14M13 4.5h6.5V11M11 13.5 19.5 5" />
    </BaseIcon>
  );
}
