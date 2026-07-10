import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { shortcutService, type ShortcutAction, type ShortcutBinding } from "../services/shortcutService";

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
    <section className="shortcut-settings" aria-labelledby="shortcut-settings-title">
      <header>
        <div><h3 id="shortcut-settings-title">Keyboard Shortcuts</h3><p>Customize Picom shortcuts locally. Operating-system and desktop-runtime shortcuts are protected.</p></div>
        <button type="button" onClick={() => { setBindings(shortcutService.resetDefaults()); setRecording(null); setMessage("Default shortcuts restored."); }}>Reset defaults</button>
      </header>
      <div className="shortcut-list">
        {bindings.map((binding) => (
          <article key={binding.action}>
            <span><strong>{binding.actionLabel}</strong><small>{binding.description}</small></span>
            <button type="button" className={recording === binding.action ? "recording" : ""} disabled={!binding.configurable} aria-label={binding.configurable ? `Change ${binding.actionLabel} shortcut` : `${binding.actionLabel} shortcut is fixed`} onClick={() => { setRecording(binding.action); setMessage(`Press a new combination for ${binding.actionLabel}. Escape cancels.`); }} onKeyDown={(event) => capture(event, binding.action)}>
              {recording === binding.action ? "Press keys..." : binding.label}
            </button>
          </article>
        ))}
      </div>
      <p className="shortcut-settings-message" role="status">{message}</p>
    </section>
  );
}
