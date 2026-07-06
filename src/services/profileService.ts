import { currentUserId } from "../data/mockCommunities";
import { mockProfiles } from "../data/mockProfiles";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

export const PROFILE_SELECT = "id, username, display_name, avatar_url, status, status_text, bio, accent_color, created_at, updated_at" as const;

export type SupabaseProfileStatus = "online" | "idle" | "dnd" | "offline";

export type ProfileRow = Readonly<{
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
  status_text: string;
  bio: string | null;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
}>;

export type ProfileSummary = Readonly<{
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: SupabaseProfileStatus;
  statusText: string;
  bio: string | null;
  accentColor: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type UpdateCurrentProfileInput = Readonly<{
  displayName?: string;
  statusText?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  accentColor?: string | null;
}>;

export type ProfileServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_FETCH_FAILED"
  | "PROFILE_UPDATE_FAILED";

export type ProfileServiceError = Readonly<{
  code: ProfileServiceErrorCode;
  message: string;
}>;

export type ProfileServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: ProfileServiceError }>;

function profileError(code: ProfileServiceErrorCode, message: string): ProfileServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function normalizeProfileStatus(status: string | null | undefined): SupabaseProfileStatus {
  if (status === "online" || status === "idle" || status === "dnd" || status === "offline") {
    return status;
  }

  return "offline";
}

function mapProfileRow(row: ProfileRow): ProfileSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: normalizeProfileStatus(row.status),
    statusText: row.status_text,
    bio: row.bio,
    accentColor: row.accent_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMockProfile(userId: string): ProfileSummary | null {
  const profile = mockProfiles.find((item) => item.id === userId);
  if (!profile) return null;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? null,
    status: profile.status === "busy" ? "dnd" : profile.status,
    statusText: profile.statusText ?? profile.status,
    bio: profile.bio,
    accentColor: "#007571",
    createdAt: profile.joinedAt,
    updatedAt: null,
  };
}

function validateUpdate(input: UpdateCurrentProfileInput): ProfileServiceError | null {
  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();
    if (!displayName) return { code: "VALIDATION_ERROR", message: "Display name is required." };
    if (displayName.length > 80) return { code: "VALIDATION_ERROR", message: "Display name must be 80 characters or fewer." };
  }

  if (input.statusText !== undefined && input.statusText.length > 120) {
    return { code: "VALIDATION_ERROR", message: "Status text must be 120 characters or fewer." };
  }

  if (input.bio !== undefined && input.bio !== null && input.bio.length > 500) {
    return { code: "VALIDATION_ERROR", message: "Bio must be 500 characters or fewer." };
  }

  return null;
}

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();

  if (!status.configured) {
    return profileError("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase data source is not configured.");
  }

  const client = getSupabaseClient();
  if (!client) {
    return profileError("DATA_SOURCE_NOT_CONFIGURED", "Supabase client is unavailable.");
  }

  return { ok: true as const, data: client };
}

export const profileService = {
  async getCurrentProfile(): Promise<ProfileServiceResult<ProfileSummary | null>> {
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return { ok: true, data: mapMockProfile(currentUserId) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data: userData, error: userError } = await configured.data.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) {
      return profileError("AUTH_REQUIRED", "Sign in before loading your profile.");
    }

    return this.getProfileById(userId);
  },

  async getProfileById(userId: string): Promise<ProfileServiceResult<ProfileSummary | null>> {
    if (!userId.trim()) {
      return profileError("VALIDATION_ERROR", "Profile user ID is required.");
    }

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return { ok: true, data: mapMockProfile(userId) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error } = await configured.data
      .from("profiles")
      .select(PROFILE_SELECT)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return profileError("PROFILE_FETCH_FAILED", "Could not load profile.");
    }

    return { ok: true, data: data ? mapProfileRow(data) : null };
  },

  async updateCurrentProfile(input: UpdateCurrentProfileInput): Promise<ProfileServiceResult<ProfileSummary>> {
    const validation = validateUpdate(input);
    if (validation) return { ok: false, error: validation };

    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const existing = mapMockProfile(currentUserId);
      if (!existing) return profileError("PROFILE_NOT_FOUND", "Current profile was not found.");
      return {
        ok: true,
        data: {
          ...existing,
          displayName: input.displayName?.trim() ?? existing.displayName,
          statusText: input.statusText?.trim() ?? existing.statusText,
          bio: input.bio === undefined ? existing.bio : input.bio?.trim() || null,
          avatarUrl: input.avatarUrl === undefined ? existing.avatarUrl : input.avatarUrl,
          accentColor: input.accentColor === undefined ? existing.accentColor : input.accentColor,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data: userData, error: userError } = await configured.data.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) {
      return profileError("AUTH_REQUIRED", "Sign in before updating your profile.");
    }

    const updatePayload: {
      display_name?: string;
      status_text?: string;
      bio?: string | null;
      avatar_url?: string | null;
      accent_color?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };
    if (input.displayName !== undefined) updatePayload.display_name = input.displayName.trim();
    if (input.statusText !== undefined) updatePayload.status_text = input.statusText.trim();
    if (input.bio !== undefined) updatePayload.bio = input.bio?.trim() || null;
    if (input.avatarUrl !== undefined) updatePayload.avatar_url = input.avatarUrl;
    if (input.accentColor !== undefined) updatePayload.accent_color = input.accentColor;

    const { data, error } = await configured.data
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select(PROFILE_SELECT)
      .single();

    if (error || !data) {
      return profileError("PROFILE_UPDATE_FAILED", "Could not update profile.");
    }

    return { ok: true, data: mapProfileRow(data) };
  },
};
