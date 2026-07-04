import type { IconName } from "./AppIcon";

export const semanticIconRegistry = {
  home: "home",
  add: "plus",
  settings: "settings",
  search: "search",
  notifications: "bell",
  inbox: "inbox",
  pinned: "pin",
  members: "users",
  textChannel: "hash",
  voiceChannel: "voice",
  privateChannel: "lock",
  expand: "chevronDown",
  collapse: "chevronRight",
  sendMessage: "send",
  imageAttachment: "image",
  emoji: "smile",
  moreActions: "more",
  reply: "reply",
  close: "close",
  minimizeWindow: "minimize",
  maximizeWindow: "maximize",
  profile: "user",
  microphone: "microphone",
  headphones: "headphones",
  attachFile: "paperclip",
  lightTheme: "sun",
  darkTheme: "moon",
} as const satisfies Record<string, IconName>;

export type SemanticIconName = keyof typeof semanticIconRegistry;

export function resolveSemanticIcon(name: SemanticIconName): IconName {
  return semanticIconRegistry[name];
}