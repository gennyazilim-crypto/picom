export type SlashCommandName = "help" | "invite" | "me" | "shrug" | "tableflip" | "topic" | "poll";
export type SlashCommand = Readonly<{ name: SlashCommandName; description: string; usage: string; permission?: "invite" | "topic" | "poll" }>;
export const builtInSlashCommands: SlashCommand[] = [
  { name: "help", description: "Show the available built-in commands.", usage: "/help" },
  { name: "invite", description: "Open the community invite creator.", usage: "/invite", permission: "invite" },
  { name: "me", description: "Send an action-style message.", usage: "/me waves" },
  { name: "shrug", description: "Insert a shrug into your message.", usage: "/shrug" },
  { name: "tableflip", description: "Insert a table flip into your message.", usage: "/tableflip" },
  { name: "topic", description: "Open channel topic editing when permitted.", usage: "/topic", permission: "topic" },
  { name: "poll", description: "Open the poll creator when available.", usage: "/poll", permission: "poll" },
];

export const slashCommandService = {
  getSuggestions(value: string): SlashCommand[] { const match = /^\/([^\s]*)$/.exec(value); if (!match) return []; const query = match[1].toLowerCase(); return builtInSlashCommands.filter((command) => command.name.startsWith(query)); },
  applyTextCommand(command: SlashCommandName): string | null { if (command === "me") return "/me "; if (command === "shrug") return "¯\\_(ツ)_/¯"; if (command === "tableflip") return "(╯°□°）╯︵ ┻━┻"; return null; },
  transformBeforeSend(value: string): string { const action = /^\/me\s+(.+)$/s.exec(value.trim()); return action ? `*${action[1].trim()}*` : value; },
};
