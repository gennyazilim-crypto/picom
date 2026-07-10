import type { SlashCommand } from "../services/slashCommandService";
import { AppIcon } from "./AppIcon";

export function SlashCommandPopover({ commands, selectedIndex, onSelect }: { commands: SlashCommand[]; selectedIndex: number; onSelect: (command: SlashCommand) => void }) {
  if (!commands.length) return null;
  return <div className="slash-command-popover" role="listbox" aria-label="Slash command suggestions">{commands.map((command, index) => <button key={command.name} type="button" role="option" aria-selected={index === selectedIndex} className={index === selectedIndex ? "selected" : ""} onMouseDown={(event) => { event.preventDefault(); onSelect(command); }}><span><AppIcon name="hash" size="sm" /></span><div><strong>/{command.name}</strong><small>{command.description}</small></div><code>{command.usage}</code></button>)}</div>;
}
