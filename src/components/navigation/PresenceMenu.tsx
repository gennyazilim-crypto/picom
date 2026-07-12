import { useEffect, type RefObject } from "react";
import type { PresencePreference } from "../../types/presence";

const options: ReadonlyArray<Readonly<{ value: PresencePreference; label: string; dot: "online" | "idle" | "dnd" | "offline" }>> = [
  { value: "online", label: "Online", dot: "online" },
  { value: "idle", label: "Idle", dot: "idle" },
  { value: "dnd", label: "Do Not Disturb", dot: "dnd" },
  { value: "invisible", label: "Invisible", dot: "offline" },
];

export function PresenceMenu({ open, compact, preference, boundaryRef, onChange, onClose }: Readonly<{
  open: boolean;
  compact: boolean;
  preference: PresencePreference;
  boundaryRef: RefObject<HTMLElement | null>;
  onChange: (preference: PresencePreference) => void;
  onClose: () => void;
}>) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!boundaryRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [boundaryRef, onClose, open]);

  if (!open) return null;
  return (
    <div
      className="global-presence-menu"
      role="menu"
      aria-label="Set presence"
      style={{ position: "absolute", left: compact ? "calc(100% + 8px)" : 0, bottom: compact ? 0 : "calc(100% + 8px)", zIndex: 80, width: 190, display: "grid", gap: 3, padding: 7, border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--surface-elevated, var(--surface))", boxShadow: "var(--shadow-app)" }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={preference === option.value}
          className={`global-nav-item${preference === option.value ? " is-active" : ""}`}
          style={{ minHeight: 34, gridTemplateColumns: "18px minmax(0, 1fr) auto", paddingBlock: 3 }}
          onClick={() => { onChange(option.value); onClose(); }}
        >
          <i className={`global-presence-dot is-${option.dot}`} style={{ position: "static", display: "block", borderColor: "var(--surface-elevated, var(--surface))" }} aria-hidden="true" />
          <span className="global-nav-item__label">{option.label}</span>
          <span aria-hidden="true">{preference === option.value ? "✓" : ""}</span>
        </button>
      ))}
    </div>
  );
}
