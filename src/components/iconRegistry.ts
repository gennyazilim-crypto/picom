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
  edit: "edit",
  delete: "trash",
  close: "close",
  minimizeWindow: "minimize",
  maximizeWindow: "maximize",
  profile: "user",
  microphone: "microphone",
  headphones: "headphones",
  attachFile: "paperclip",
  lightTheme: "sun",
  darkTheme: "moon",
  logout: "logout",
} as const satisfies Record<string, IconName>;

export type SemanticIconName = keyof typeof semanticIconRegistry;

export function resolveSemanticIcon(name: SemanticIconName): IconName {
  return semanticIconRegistry[name];
}
export const mvpUiIconMap = {
  windowTitleBar: {
    search: semanticIconRegistry.search,
    lightTheme: semanticIconRegistry.lightTheme,
    darkTheme: semanticIconRegistry.darkTheme,
    minimize: semanticIconRegistry.minimizeWindow,
    maximize: semanticIconRegistry.maximizeWindow,
    close: semanticIconRegistry.close,
  },
  serverRail: {
    home: semanticIconRegistry.home,
    addCommunity: semanticIconRegistry.add,
    discover: semanticIconRegistry.search,
    settings: semanticIconRegistry.settings,
    logout: semanticIconRegistry.logout,
  },
  communitySidebar: {
    textChannel: semanticIconRegistry.textChannel,
    voiceChannel: semanticIconRegistry.voiceChannel,
    privateChannel: semanticIconRegistry.privateChannel,
    expand: semanticIconRegistry.expand,
    collapse: semanticIconRegistry.collapse,
    mute: semanticIconRegistry.microphone,
    deafen: semanticIconRegistry.headphones,
    settings: semanticIconRegistry.settings,
  },
  chatHeader: {
    pinned: semanticIconRegistry.pinned,
    notifications: semanticIconRegistry.notifications,
    inbox: semanticIconRegistry.inbox,
    members: semanticIconRegistry.members,
    search: semanticIconRegistry.search,
    more: semanticIconRegistry.moreActions,
  },
  messageComposer: {
    attach: semanticIconRegistry.attachFile,
    emoji: semanticIconRegistry.emoji,
    send: semanticIconRegistry.sendMessage,
    image: semanticIconRegistry.imageAttachment,
    close: semanticIconRegistry.close,
  },
  messageItem: {
    reply: semanticIconRegistry.reply,
    react: semanticIconRegistry.emoji,
    edit: semanticIconRegistry.edit,
    delete: semanticIconRegistry.delete,
    more: semanticIconRegistry.moreActions,
  },
  memberSidebar: {
    search: semanticIconRegistry.search,
    profile: semanticIconRegistry.profile,
  },
  overlays: {
    close: semanticIconRegistry.close,
    search: semanticIconRegistry.search,
  },
} as const satisfies Record<string, Record<string, IconName>>;
