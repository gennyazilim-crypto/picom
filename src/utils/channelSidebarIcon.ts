import type { Channel } from "../types/community";
import type { IconName } from "../components/AppIcon";

/**
 * Sidebar icons prefer channel type, then private flag, then common name cues.
 * Falls back to hash only when nothing more specific matches.
 */
const NAME_ICON_RULES: ReadonlyArray<{ pattern: RegExp; icon: IconName }> = [
  { pattern: /\b(announce|announcement|announcements|news|notices?)\b/i, icon: "bell" },
  { pattern: /\b(welcome|intro|start-here|start_here|hello)\b/i, icon: "home" },
  { pattern: /\b(rules|guidelines|mod|mods|moderation|admin|staff|security)\b/i, icon: "lock" },
  { pattern: /\b(general|chat|talk|lounge|lobby|hangout|off-?topic|random)\b/i, icon: "users" },
  { pattern: /\b(help|support|questions|faq|ask)\b/i, icon: "inbox" },
  { pattern: /\b(media|images?|gallery|screenshots?|photos?|clips?)\b/i, icon: "image" },
  { pattern: /\b(files?|resources?|links?|docs?|documents?|attachments?)\b/i, icon: "paperclip" },
  { pattern: /\b(events?|calendar|meetup|schedule)\b/i, icon: "bell" },
  { pattern: /\b(feedback|ideas?|suggestions?|critique)\b/i, icon: "edit" },
  { pattern: /\b(music|audio|podcast|radio|listening)\b/i, icon: "headphones" },
  { pattern: /\b(dev|development|coding|engineering|bot-?commands?)\b/i, icon: "hash" },
  { pattern: /\b(planning|project|workspace|project-?updates?|release.?notes?)\b/i, icon: "pin" },
  { pattern: /\b(fun|memes?|jokes?|social|inspiration)\b/i, icon: "smile" },
];

function iconFromChannelName(name: string): IconName | null {
  const normalized = name.trim().replace(/[_/]+/g, "-").replace(/\s+/g, " ");
  for (const rule of NAME_ICON_RULES) {
    if (rule.pattern.test(normalized)) return rule.icon;
  }
  return null;
}

export function resolveChannelSidebarIcon(channel: Pick<Channel, "name" | "type" | "isPrivate">): IconName {
  if (channel.type === "voice") return "voice";
  if (channel.type === "announcement") return "bell";
  if (channel.type === "forum") return "inbox";
  if (channel.isPrivate) return "lock";

  return iconFromChannelName(channel.name) ?? "hash";
}
