import type { MouseEvent } from "react";
import "./MeetingAccessibilityNavigation.css";

const focusTarget = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
  event.preventDefault();
  const target = document.getElementById(id);
  target?.focus();
  target?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
};

export function MeetingAccessibilityNavigation({ dockAvailable, panelAvailable }: { dockAvailable: boolean; panelAvailable: boolean }) {
  return <nav className="meeting-accessibility-nav" aria-label="Meeting skip links">
    <a href="#meeting-media-stage" onClick={(event) => focusTarget(event, "meeting-media-stage")}>Skip to meeting stage</a>
    {dockAvailable ? <a href="#meeting-control-dock" onClick={(event) => focusTarget(event, "meeting-control-dock")}>Skip to meeting controls</a> : null}
    {panelAvailable ? <a href="#meeting-side-panel" onClick={(event) => focusTarget(event, "meeting-side-panel")}>Skip to meeting panel</a> : null}
  </nav>;
}
