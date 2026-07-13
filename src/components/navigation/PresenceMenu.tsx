import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { PresencePreference } from "../../types/presence";

const options: ReadonlyArray<Readonly<{ value: PresencePreference; label: string; dot: "online" | "idle" | "dnd" | "offline" }>> = [
  { value: "online", label: "Online", dot: "online" },
  { value: "idle", label: "Idle", dot: "idle" },
  { value: "dnd", label: "Do Not Disturb", dot: "dnd" },
  { value: "invisible", label: "Invisible", dot: "offline" },
];

const MENU_WIDTH = 190;
const MENU_ESTIMATED_HEIGHT = 168;

function getMenuPosition(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUp = spaceAbove >= MENU_ESTIMATED_HEIGHT + 8 || spaceBelow < MENU_ESTIMATED_HEIGHT + 8;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - MENU_WIDTH - 8);
  const top = openUp ? rect.top - MENU_ESTIMATED_HEIGHT - 8 : rect.bottom + 8;
  return { top, left };
}

export function PresenceMenu({
  open,
  preference,
  boundaryRef,
  triggerRef,
  onChange,
  onClose,
}: Readonly<{
  open: boolean;
  compact?: boolean;
  preference: PresencePreference;
  boundaryRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
  onChange: (preference: PresencePreference) => void;
  onClose: (restoreFocus?: boolean) => void;
}>) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPosition(null);
      return;
    }
    setPosition(getMenuPosition(triggerRef.current));
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    let removeListeners: (() => void) | undefined;
    const frame = window.requestAnimationFrame(() => {
      if (!active) return;
      const onPointerDown = (event: PointerEvent) => {
        const target = event.target as Node;
        if (triggerRef.current?.contains(target)) return;
        if (menuRef.current?.contains(target)) return;
        if (boundaryRef.current?.contains(target)) return;
        onClose();
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") onClose(true);
      };
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      removeListeners = () => {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    });
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      removeListeners?.();
    };
  }, [boundaryRef, onClose, open, triggerRef]);

  if (!open || !position) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="global-presence-menu"
      role="menu"
      aria-label="Set presence"
      style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="menuitemradio"
          aria-checked={preference === option.value}
          className={`global-presence-menu__option${preference === option.value ? " is-active" : ""}`}
          onClick={() => {
            onChange(option.value);
            onClose(true);
          }}
        >
          <i className={`global-presence-dot is-${option.dot}`} aria-hidden="true" />
          <span>{option.label}</span>
          <span aria-hidden="true">{preference === option.value ? "✓" : ""}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
