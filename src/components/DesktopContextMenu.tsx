import { useEffect } from "react";
import type { OverlayMenuItem } from "../state/useOverlayState";

type DesktopContextMenuProps = {
  x: number;
  y: number;
  items: OverlayMenuItem[];
  onClose: () => void;
};

export function DesktopContextMenu({ x, y, items, onClose }: DesktopContextMenuProps) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const left = Math.min(x, Math.max(16, window.innerWidth - 238));
  const top = Math.min(y, Math.max(16, window.innerHeight - (items.length * 38 + 24)));

  return (
    <div className="desktop-context-menu" style={{ left, top }} onPointerDown={(event) => event.stopPropagation()}>
      {items.map((item) => (
        <button
          key={item.label}
          className={`context-menu-item ${item.tone === "danger" ? "danger" : ""}`}
          disabled={item.disabled}
          onClick={() => {
            item.onSelect?.();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
