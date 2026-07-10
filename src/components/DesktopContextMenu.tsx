import { useEffect, useRef } from "react";
import type { OverlayMenuItem } from "../state/useOverlayState";
import { clampOverlayPosition } from "../utils/desktopDisplayBounds";

type DesktopContextMenuProps = { x: number; y: number; items: OverlayMenuItem[]; onClose: () => void };

export function DesktopContextMenu({ x, y, items, onClose }: DesktopContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const close = () => onClose();
    const enabledItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const buttons = enabledItems();
      if (!buttons.length) return;
      event.preventDefault();
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (currentIndex + 1 + buttons.length) % buttons.length : (currentIndex - 1 + buttons.length) % buttons.length;
      buttons[nextIndex].focus();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.requestAnimationFrame(() => enabledItems()[0]?.focus());
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [onClose]);

  const { left, top } = clampOverlayPosition({
    x,
    y,
    width: 220,
    height: items.length * 38 + 12,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    margin: 16,
  });
  return <div ref={menuRef} className="desktop-context-menu" role="menu" aria-label="Context actions" style={{ left, top }} onPointerDown={(event) => event.stopPropagation()}>
    {items.map((item) => <button key={item.label} type="button" role="menuitem" className={`context-menu-item ${item.tone === "danger" ? "danger" : ""}`} disabled={item.disabled} onClick={() => { item.onSelect?.(); onClose(); }}>{item.label}</button>)}
  </div>;
}
