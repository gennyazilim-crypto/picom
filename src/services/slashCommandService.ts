export type SlashCommandName = "help" | "invite" | "me" | "shrug" | "tableflip" | "topic" | "poll";
export type SlashCommandPermission = "invite" | "topic" | "poll";
export type SlashCommandPermissionContext = Readonly<Record<SlashCommandPermission, boolean>>;

export type SlashCommand = Readonly<{
  source: "builtin";
  name: SlashCommandName;
  description: string;
  usage: string;
  permission?: SlashCommandPermission;
}>;

export type ExternalSlashCommandRegistration = Readonly<{
  source: "bot" | "plugin";
  providerId: string;
  name: string;
  description: string;
  requiredPermission?: string;
}>;

const MAX_SUGGESTIONS = 8;
const SAFE_COMMAND_NAME = /^[a-z][a-z0-9_-]{0,31}$/;
const SAFE_PROVIDER_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const EMPTY_PERMISSIONS: SlashCommandPermissionContext = { invite: false, topic: false, poll: false };

export const builtInSlashCommands: readonly SlashCommand[] = Object.freeze([
  { source: "builtin", name: "help", description: "Show the available built-in commands.", usage: "/help" },
  { source: "builtin", name: "invite", description: "Open the community invite creator.", usage: "/invite", permission: "invite" },
  { source: "builtin", name: "me", description: "Send an action-style message.", usage: "/me waves" },
  { source: "builtin", name: "shrug", description: "Insert a shrug into your message.", usage: "/shrug" },
  { source: "builtin", name: "tableflip", description: "Insert a table flip into your message.", usage: "/tableflip" },
  { source: "builtin", name: "topic", description: "Open channel topic editing when permitted.", usage: "/topic", permission: "topic" },
  { source: "builtin", name: "poll", description: "Open the poll creator when available.", usage: "/poll", permission: "poll" },
]);

function isCommandAllowed(command: SlashCommand, permissions: SlashCommandPermissionContext): boolean {
  return !command.permission || permissions[command.permission];
}

function validateExternalRegistration(registration: ExternalSlashCommandRegistration): ExternalSlashCommandRegistration {
  const runtimeKeys = Object.keys(registration as unknown as Record<string, unknown>);
  const allowedKeys = new Set(["source", "providerId", "name", "description", "requiredPermission"]);
  if (runtimeKeys.some((key) => !allowedKeys.has(key))) throw new Error("External slash commands accept metadata only.");
  if (registration.source !== "bot" && registration.source !== "plugin") throw new Error("Unsupported slash command source.");
  if (!SAFE_PROVIDER_ID.test(registration.providerId)) throw new Error("Invalid slash command provider.");
  if (!SAFE_COMMAND_NAME.test(registration.name)) throw new Error("Invalid slash command name.");
  const description = registration.description.trim();
  if (!description || description.length > 160) throw new Error("Invalid slash command description.");
  return Object.freeze({ ...registration, description });
}

const externalRegistrations = new Map<string, ExternalSlashCommandRegistration>();

export const slashCommandService = {
  getSuggestions(value: string, permissions: SlashCommandPermissionContext = EMPTY_PERMISSIONS): SlashCommand[] {
    const match = /^\/([^\s]*)$/.exec(value);
    if (!match) return [];
    const query = match[1].toLowerCase();
    return builtInSlashCommands
      .filter((command) => command.name.startsWith(query) && isCommandAllowed(command, permissions))
      .slice(0, MAX_SUGGESTIONS);
  },
  canUseCommand(command: SlashCommand, permissions: SlashCommandPermissionContext): boolean {
    return isCommandAllowed(command, permissions);
  },
  registerExternalMetadata(registration: ExternalSlashCommandRegistration, canRegister: boolean): ExternalSlashCommandRegistration {
    if (!canRegister) throw new Error("Permission denied for slash command registration.");
    const validated = validateExternalRegistration(registration);
    externalRegistrations.set(`${validated.source}:${validated.providerId}:${validated.name}`, validated);
    return validated;
  },
  listExternalMetadata(): ExternalSlashCommandRegistration[] {
    return [...externalRegistrations.values()];
  },
  clearExternalMetadataForTests(): void {
    externalRegistrations.clear();
  },
  applyTextCommand(command: SlashCommandName): string | null {
    if (command === "me") return "/me ";
    if (command === "shrug") return "\u00af\\_(\u30c4)_/\u00af";
    if (command === "tableflip") return "(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35 \u253b\u2501\u253b";
    return null;
  },
  transformBeforeSend(value: string): string {
    const action = /^\/me\s+(.+)$/s.exec(value.trim());
    return action ? `*${action[1].trim()}*` : value;
  },
};
