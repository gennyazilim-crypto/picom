import type { CommunityKind } from "./community";
import type { CommunityPermissionKey, CommunityPermissionOverrideEffect } from "./communityAccess";

export type AudioCommunityKind = Exclude<CommunityKind, "text">;
export type CommunityStructureVisibility = "public" | "members" | "managers";
export type CommunityStructureSectionType =
  | "radio_programs"
  | "radio_schedule"
  | "radio_hosts"
  | "radio_listener_chat"
  | "podcast_series"
  | "podcast_episodes"
  | "podcast_drafts"
  | "podcast_publishers"
  | "podcast_listener_discussion";

export type CommunityStructureSection = Readonly<{
  id: string;
  communityId: string;
  communityKind: AudioCommunityKind;
  sectionType: CommunityStructureSectionType;
  label: string;
  position: number;
  visibility: CommunityStructureVisibility;
  isEnabled: boolean;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type ManagedCategorySummary = Readonly<{ id: string; name: string; position: number }>;
export type ManagedPermissionOverride = Readonly<{
  roleId: string;
  permission: CommunityPermissionKey;
  effect: CommunityPermissionOverrideEffect;
}>;

export type CommunityStructureResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: string }>;
