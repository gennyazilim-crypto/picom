import type { ChannelType } from "./community";

export type CommunityTemplateId =
  | "custom"
  | "gaming"
  | "study-group"
  | "developer-team"
  | "music-community"
  | "design-studio"
  | "work-space";

export type CommunityTemplateChannel = Readonly<{
  name: string;
  type: ChannelType;
  topic?: string;
  isPrivate?: boolean;
}>;

export type CommunityTemplateCategory = Readonly<{
  name: string;
  channels: readonly CommunityTemplateChannel[];
}>;

export type CommunityTemplate = Readonly<{
  id: CommunityTemplateId;
  name: string;
  description: string;
  accentColor: string;
  categories: readonly CommunityTemplateCategory[];
  defaultRoles: readonly string[];
  welcomeMessage: string;
}>;
