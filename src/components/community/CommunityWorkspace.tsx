import type { ReactNode } from "react";

export function CommunityWorkspace({ serverRail, children }: Readonly<{ serverRail: ReactNode; children: ReactNode }>) {
  return (
    <section
      className="community-workspace"
      aria-label="Community workspace"
      style={{ minWidth: 0, minHeight: 0, flex: "1 1 auto", display: "flex", overflow: "hidden" }}
    >
      {serverRail}
      {children}
    </section>
  );
}
