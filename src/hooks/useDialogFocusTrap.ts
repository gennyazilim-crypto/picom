import { useEffect, useRef } from "react";

const FOCUSABLE = ["button:not([disabled])", "a[href]", "input:not([disabled])", "select:not([disabled])", "textarea:not([disabled])", "[contenteditable='true']", "[tabindex]:not([tabindex='-1'])"].join(",");
const INITIAL_FOCUSABLE = ["[data-dialog-initial-focus], [autofocus]", "input:not([disabled])", "select:not([disabled])", "textarea:not([disabled])", "[contenteditable='true']", "button:not([disabled]):not(.modal-close)", "a[href]", "[tabindex]:not([tabindex='-1'])"].join(",");

export function useDialogFocusTrap<T extends HTMLElement>(onClose: () => void) {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    const isTopmostDialog = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>("[aria-modal='true']"));
      return dialogs[dialogs.length - 1] === containerRef.current;
    };
    const initialFocusFrame = window.requestAnimationFrame(() => {
      if (!container || !isTopmostDialog()) return;
      (container.querySelector<HTMLElement>(INITIAL_FOCUSABLE) ?? container).focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostDialog()) return;
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !containerRef.current) return;
      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.offsetParent !== null);
      if (!focusable.length) { event.preventDefault(); containerRef.current.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!containerRef.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(initialFocusFrame);
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, []);
  return containerRef;
}
