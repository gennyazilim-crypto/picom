import { currentUserId } from "../data/mockCommunities";
import { mockProfiles } from "../data/mockProfiles";
import type { ProfileStatus, UserProfile } from "../types/profile";
import { dataSourceService } from "./dataSourceService";
import type { Database, Json } from "./supabase/database.types";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

/** @deprecated Profile reads use the privacy-projected profile-domain RPC. */
export const PROFILE_SELECT = "profile-domain-rpc" as const;
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type SupabaseProfileStatus = "online" | "idle" | "dnd" | "offline";

export type ProfileSummary = Readonly<Pick<UserProfile,
  "id" | "username" | "displayName" | "status" | "statusText" | "joinedAt" | "bio" | "tags" | "onboardingCompleted"
> & {
  avatarUrl?: string;
  coverUrl?: string;
  location?: string;
  timezone?: string;
  preferredLanguage?: string;
  accentColor?: string;
  updatedAt?: string;
}>;

export type UpdateCurrentProfileInput = Readonly<{
  username?: string;
  displayName?: string;
  status?: ProfileStatus;
  statusText?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  preferredLanguage?: string | null;
  tags?: readonly string[];
  location?: string | null;
  timezone?: string | null;
  accentColor?: string | null;
}>;

export type ProfileServiceErrorCode = "DATA_SOURCE_NOT_CONFIGURED" | "AUTH_REQUIRED" | "VALIDATION_ERROR" | "PROFILE_NOT_FOUND" | "PROFILE_FETCH_FAILED" | "PROFILE_UPDATE_FAILED";
export type ProfileServiceError = Readonly<{ code: ProfileServiceErrorCode; message: string }>;
export type ProfileServiceResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: ProfileServiceError }>;

function profileError(code: ProfileServiceErrorCode, message: string): ProfileServiceResult<never> { return { ok: false, error: { code, message } }; }
function asRecord(value: Json | undefined): Record<string, Json | undefined> { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function text(value: Json | undefined): string | undefined { return typeof value === "string" ? value : undefined; }
function strings(value: Json | undefined): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function status(value: Json | undefined): ProfileStatus { if (value === "online" || value === "idle" || value === "offline") return value; return value === "dnd" || value === "busy" ? "busy" : "offline"; }

function mapDomainPayload(payload: Json): ProfileSummary | null {
  const root = asRecord(payload);
  if (root.can_view_profile !== true) return null;
  const profile = asRecord(root.profile);
  const id = text(profile.id); const username = text(profile.username); const displayName = text(profile.display_name); const joinedAt = text(profile.created_at);
  if (!id || !username || !displayName || !joinedAt) return null;
  return {
    id,
    username,
    displayName,
    avatarUrl: text(profile.avatar_url),
    coverUrl: text(profile.cover_url),
    status: status(profile.status),
    statusText: text(profile.status_text),
    bio: text(profile.bio) ?? "",
    location: text(profile.location),
    timezone: text(profile.timezone),
    preferredLanguage: text(profile.preferred_language),
    tags: strings(profile.tags),
    onboardingCompleted: profile.onboarding_completed === true,
    accentColor: text(profile.accent_color),
    joinedAt,
    updatedAt: text(profile.updated_at),
  };
}

function mapMockProfile(userId: string): ProfileSummary | null {
  const profile = mockProfiles.find((item) => item.id === userId);
  if (!profile) return null;
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    status: profile.status,
    statusText: profile.statusText,
    bio: profile.bio,
    location: profile.location,
    timezone: profile.timezone,
    preferredLanguage: profile.preferredLanguage,
    tags: [...profile.tags],
    onboardingCompleted: profile.onboardingCompleted,
    accentColor: "#007571",
    joinedAt: profile.joinedAt,
  };
}

function validateUpdate(input: UpdateCurrentProfileInput): ProfileServiceError | null {
  if (input.username !== undefined && !/^[a-z0-9._-]{3,32}$/.test(input.username.trim().toLowerCase())) return { code: "VALIDATION_ERROR", message: "Username must be 3-32 lowercase letters, numbers, dots, dashes, or underscores." };
  if (input.displayName !== undefined && (!input.displayName.trim() || input.displayName.trim().length > 80)) return { code: "VALIDATION_ERROR", message: "Display name must be 1-80 characters." };
  if (input.statusText !== undefined && input.statusText.length > 120) return { code: "VALIDATION_ERROR", message: "Status text must be 120 characters or fewer." };
  if (input.bio !== undefined && input.bio !== null && input.bio.length > 500) return { code: "VALIDATION_ERROR", message: "Bio must be 500 characters or fewer." };
  if (input.preferredLanguage !== undefined && input.preferredLanguage !== null && input.preferredLanguage.length > 48) return { code: "VALIDATION_ERROR", message: "Preferred language must be 48 characters or fewer." };
  if (input.tags && (input.tags.length > 12 || input.tags.some((tag) => !tag.trim() || tag.trim().length > 32))) return { code: "VALIDATION_ERROR", message: "Use up to 12 profile tags of 32 characters or fewer." };
  if (input.location !== undefined && input.location !== null && input.location.length > 120) return { code: "VALIDATION_ERROR", message: "Location must be 120 characters or fewer." };
  if (input.timezone !== undefined && input.timezone !== null && input.timezone.length > 80) return { code: "VALIDATION_ERROR", message: "Timezone must be 80 characters or fewer." };
  return null;
}

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();
  if (!status.configured) return profileError("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase data source is not configured.");
  const client = getSupabaseClient();
  return client ? { ok: true as const, data: client } : profileError("DATA_SOURCE_NOT_CONFIGURED", "Supabase client is unavailable.");
}

function toPatch(input: UpdateCurrentProfileInput): Json {
  const patch: Record<string, Json | undefined> = {};
  if (input.username !== undefined) patch.username = input.username.trim().toLowerCase();
  if (input.displayName !== undefined) patch.displayName = input.displayName.trim();
  if (input.status !== undefined) patch.status = input.status === "busy" ? "dnd" : input.status;
  if (input.statusText !== undefined) patch.statusText = input.statusText.trim();
  if (input.bio !== undefined) patch.bio = input.bio?.trim() || null;
  if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
  if (input.coverUrl !== undefined) patch.coverUrl = input.coverUrl;
  if (input.preferredLanguage !== undefined) patch.preferredLanguage = input.preferredLanguage?.trim() || null;
  if (input.tags !== undefined) patch.tags = input.tags.map((tag) => tag.trim());
  if (input.location !== undefined) patch.location = input.location?.trim() || null;
  if (input.timezone !== undefined) patch.timezone = input.timezone?.trim() || null;
  if (input.accentColor !== undefined) patch.accentColor = input.accentColor;
  return patch;
}

export const profileService = {
  async getCurrentProfile(): Promise<ProfileServiceResult<ProfileSummary | null>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: mapMockProfile(currentUserId) };
    const configured = getConfiguredSupabaseClient(); if (!configured.ok) return configured;
    const { data, error } = await configured.data.auth.getUser();
    if (error || !data.user) return profileError("AUTH_REQUIRED", "Sign in before loading your profile.");
    return this.getProfileById(data.user.id);
  },

  async getProfileById(userId: string): Promise<ProfileServiceResult<ProfileSummary | null>> {
    if (!userId.trim()) return profileError("VALIDATION_ERROR", "Profile user ID is required.");
    if (dataSourceService.getStatus().isMock) return { ok: true, data: mapMockProfile(userId) };
    const configured = getConfiguredSupabaseClient(); if (!configured.ok) return configured;
    const { data, error } = await configured.data.rpc("get_profile_domain_v1", { target_user_id: userId, result_limit: 30 });
    if (error) return profileError("PROFILE_FETCH_FAILED", "Could not load profile.");
    return { ok: true, data: data ? mapDomainPayload(data) : null };
  },

  async updateCurrentProfile(input: UpdateCurrentProfileInput): Promise<ProfileServiceResult<ProfileSummary>> {
    const validation = validateUpdate(input); if (validation) return { ok: false, error: validation };
    if (dataSourceService.getStatus().isMock) {
      const existing = mapMockProfile(currentUserId); if (!existing) return profileError("PROFILE_NOT_FOUND", "Current profile was not found.");
      return { ok: true, data: { ...existing, username: input.username?.trim().toLowerCase() ?? existing.username, displayName: input.displayName?.trim() ?? existing.displayName, status: input.status ?? existing.status, statusText: input.statusText?.trim() ?? existing.statusText, bio: input.bio === undefined ? existing.bio : input.bio?.trim() || "", avatarUrl: input.avatarUrl === undefined ? existing.avatarUrl : input.avatarUrl ?? undefined, coverUrl: input.coverUrl === undefined ? existing.coverUrl : input.coverUrl ?? undefined, preferredLanguage: input.preferredLanguage === undefined ? existing.preferredLanguage : input.preferredLanguage?.trim() || undefined, tags: input.tags ? input.tags.map((tag) => tag.trim()) : existing.tags, location: input.location === undefined ? existing.location : input.location?.trim() || undefined, timezone: input.timezone === undefined ? existing.timezone : input.timezone?.trim() || undefined, accentColor: input.accentColor === undefined ? existing.accentColor : input.accentColor ?? undefined, updatedAt: new Date().toISOString() } };
    }
    const configured = getConfiguredSupabaseClient(); if (!configured.ok) return configured;
    const { data: userData, error: userError } = await configured.data.auth.getUser();
    if (userError || !userData.user) return profileError("AUTH_REQUIRED", "Sign in before updating your profile.");
    const { data, error } = await configured.data.rpc("update_own_profile_domain", { profile_patch: toPatch(input) });
    const mapped = data ? mapDomainPayload(data) : null;
    return error || !mapped ? profileError("PROFILE_UPDATE_FAILED", "Could not update profile.") : { ok: true, data: mapped };
  },
};
