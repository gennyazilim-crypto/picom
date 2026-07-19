import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { shortcutService, type ShortcutAction, type ShortcutBinding } from "../services/shortcutService";
import "./KeyboardShortcutsSection.css";

export function KeyboardShortcutsSection() {
  const [bindings, setBindings] = useState<ShortcutBinding[]>(() => shortcutService.getBindings());
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [message, setMessage] = useState("Select a shortcut, then press the new key combination.");

  const capture = (event: ReactKeyboardEvent<HTMLButtonElement>, action: ShortcutAction) => {
    if (recording !== action) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecording(null);
      setMessage("Shortcut editing canceled.");
      return;
    }
    const label = shortcutService.bindingFromKeyboardEvent(event.nativeEvent);
    if (!label) {
      setMessage("Use Ctrl, Cmd, or Alt with another key.");
      return;
    }
    const result = shortcutService.updateBinding(action, label);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setBindings(result.bindings);
    setRecording(null);
    setMessage("Shortcut saved on this desktop.");
  };

  return (
    <div className="keyboard-shortcuts-stack">
      <section className="keyboard-shortcuts-section" aria-labelledby="shortcut-settings-title">
        <div className="keyboard-shortcuts-toolbar">
          <p id="shortcut-settings-title" className="settings-section-description">Customize Picom shortcuts locally. Operating-system and desktop-runtime shortcuts are protected.</p>
          <button
            type="button"
            className="settings-inline-action settings-inline-action--ghost"
            onClick={() => {
              setBindings(shortcutService.resetDefaults());
              setRecording(null);
              setMessage("Default shortcuts restored.");
            }}
          >
            Reset defaults
          </button>
        </div>

        <div className="keyboard-shortcuts-list">
          {bindings.map((binding) => (
            <article key={binding.action} className="keyboard-shortcut-row">
              <div className="keyboard-shortcut-copy">
                <strong>{binding.actionLabel}</strong>
                <small>{binding.description}</small>
              </div>
              <button
                type="button"
                className={`keyboard-shortcut-key${recording === binding.action ? " is-recording" : ""}${!binding.configurable ? " is-fixed" : ""}`}
                disabled={!binding.configurable}
                aria-label={binding.configurable ? `Change ${binding.actionLabel} shortcut. Current binding ${binding.label}.` : `${binding.actionLabel} shortcut is fixed to ${binding.label}.`}
                onClick={() => {
                  setRecording(binding.action);
                  setMessage(`Press a new combination for ${binding.actionLabel}. Escape cancels.`);
                }}
                onKeyDown={(event) => capture(event, binding.action)}
              >
                {recording === binding.action ? "Press keys..." : binding.label}
              </button>
            </article>
          ))}
        </div>

        <p className="keyboard-shortcuts-message" role="status">{message}</p>
      </section>
    </div>
  );
}
