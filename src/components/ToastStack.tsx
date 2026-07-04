import type { OverlayToast } from "../state/useOverlayState";
import { AppIcon } from "./AppIcon";

interface ToastStackProps {
  toasts: OverlayToast[];
  onDismiss: (id: OverlayToast["id"]) => void;
}

const toastLabels: Record<NonNullable<OverlayToast["tone"]>, string> = {
  info: "Notification",
  success: "Success",
  error: "Error",
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (!toasts.length) return null;

  return (
    <section className="toast-stack" role="status" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => (
        <article key={toast.id} className={`toast ${toast.tone ?? "info"}`}>
          <span className="toast-indicator" aria-hidden="true" />
          <span className="toast-copy">
            <strong>{toastLabels[toast.tone ?? "info"]}</strong>
            <span>{toast.message}</span>
          </span>
          <button className="toast-dismiss" type="button" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
            <AppIcon name="close" size="xs" />
          </button>
        </article>
      ))}
    </section>
  );
}
