import { shortcutService } from "../services/shortcutService";

export function KeyboardShortcutsSection() {
  return (
    <div className="shortcut-list">
      {shortcutService.bindings.map((binding) => (
        <div key={binding.action}>
          <strong>{binding.label}</strong>
          <span>{binding.action}</span>
        </div>
      ))}
    </div>
  );
}
