import type { ReactNode } from "react";

export function CommunityWorkspace({ serverRail, children }: Readonly<{ serverRail: ReactNode; children: ReactNode }>) {
  return (
    <section className="community-workspace" aria-label="Community workspace">
      {serverRail}
      {children}
    </section>
  );
}
