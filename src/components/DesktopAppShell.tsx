import type { ReactNode } from "react";

type DesktopAppShellProps = {
  children: ReactNode;
};

export function DesktopAppShell({ children }: DesktopAppShellProps) {
  return (
    <div className="picom-root">
      <div className="desktop-size-warning">This app is optimized for desktop.</div>
      <section className="desktop-app-shell">{children}</section>
    </div>
  );
}