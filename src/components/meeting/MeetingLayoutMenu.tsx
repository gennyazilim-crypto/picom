import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { getValidMeetingLayoutPreferences, meetingLayoutPreferenceService, type MeetingLayoutPreference } from "../../services/meeting/meetingLayoutPreferenceService";
import type { MeetingClientSnapshot } from "../../types/meetingClient";
import { AppIcon, type IconName } from "../AppIcon";
import "./MeetingLayoutMenu.css";

const metadata: Record<MeetingLayoutPreference, { label: string; detail: string; icon: IconName }> = {
  auto: { label: "Auto", detail: "Picom follows the active experience", icon: "maximize" },
  grid: { label: "Grid", detail: "Balanced participant tiles", icon: "users" },
  speaker: { label: "Speaker Focus", detail: "Active speaker or your local pin", icon: "user" },
  screen_share: { label: "Screen Share Focus", detail: "Shared content with participant context", icon: "image" },
  stage: { label: "Stage", detail: "Hosts and approved speakers", icon: "voice" },
};

export function MeetingLayoutMenu({ snapshot }: { snapshot: MeetingClientSnapshot }) {
  const preference = useSyncExternalStore(meetingLayoutPreferenceService.subscribe, meetingLayoutPreferenceService.getSnapshot, meetingLayoutPreferenceService.getSnapshot).preference;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = getValidMeetingLayoutPreferences(snapshot);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement), step = event.key === "ArrowDown" ? 1 : -1;
    buttons[(current + step + buttons.length) % buttons.length]?.focus();
  };

  return <div className="meeting-layout-menu" ref={root} onKeyDown={move}>
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Meeting layout: ${metadata[preference].label}`} onClick={() => setOpen((value) => !value)}><AppIcon name="maximize" size="sm" /><span>{metadata[preference].label}</span><AppIcon name="chevronDown" size="xs" /></button>
    {open ? <div className="meeting-layout-menu__popover" role="menu" aria-label="Choose meeting layout">
      {options.map((option) => <button type="button" role="menuitemradio" aria-checked={preference === option} key={option} onClick={() => { meetingLayoutPreferenceService.setPreference(option); setOpen(false); trigger.current?.focus(); }}><AppIcon name={metadata[option].icon} size="sm" /><span><strong>{metadata[option].label}</strong><small>{metadata[option].detail}</small></span>{preference === option ? <span className="meeting-layout-menu__selected" aria-hidden="true">●</span> : null}</button>)}
    </div> : null}
  </div>;
}
