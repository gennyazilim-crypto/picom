import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import { getMockCommunityKind, listMockCommunitySummaries, listSupabaseCommunitySummaries, mapCommunityListRow } from "./communityListQuery";
import { isCommunityTemplateId } from "../data/communityTemplates";
import { isCommunityKind, type CommunityKind } from "../types/community";

export type CommunitySummary = Readonly<{
  id: string;
  kind: CommunityKind;
  ownerId: string | null;
  name: string;
  description: string | null;
  iconUrl: string | null;
  accentColor: string;
  visibility: "public" | "private";
  publicReadEnabled: boolean;
  rulesEnabled: boolean;
  rulesVersion: string;
  templateId?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type CreateCommunityInput = Readonly<{
  creationRequestId?: string;
  name: string;
  kind?: CommunityKind;
  description?: string | null;
  iconUrl?: string | null;
  accentColor?: string;
  visibility?: "public" | "private";
  publicReadEnabled?: boolean;
  templateId?: string | null;
}>;

export type UpdateCommunityInput = Readonly<{
  id: string;
  name?: string;
  description?: string | null;
  iconUrl?: string | null;
  accentColor?: string;
  visibility?: "public" | "private";
  publicReadEnabled?: boolean;
}>;

export type CommunityServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "COMMUNITY_CREATE_FAILED"
  | "COMMUNITY_TEMPLATE_FAILED"
  | "COMMUNITY_UPDATE_FAILED"
  | "COMMUNITY_LIST_FAILED";

export type CommunityServiceError = Readonly<{
  code: CommunityServiceErrorCode;
  message: string;
}>;

export type CommunityServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: CommunityServiceError }>;

function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mockCommunityCreations = new Map<string, CommunitySummary>();

function validateCreateInput(input: CreateCommunityInput): CommunityServiceError | null {
  const name = cleanName(input.name);

  if (input.creationRequestId !== undefined && !UUID_PATTERN.test(input.creationRequestId.trim())) {
    return { code: "VALIDATION_ERROR", message: "Community creation request ID must be a UUID." };
  }

  if (input.kind !== undefined && !isCommunityKind(input.kind)) {
    return { code: "VALIDATION_ERROR", message: "Community kind must be text, radio, or podcast." };
  }

  if (!name) {
    return { code: "VALIDATION_ERROR", message: "Community name is required." };
  }

  if (name.length > 80) {
    return { code: "VALIDATION_ERROR", message: "Community name must be 80 characters or fewer." };
  }

  if (input.description && input.description.length > 500) {
    return { code: "VALIDATION_ERROR", message: "Community description must be 500 characters or fewer." };
  }

  if (input.iconUrl) {
    const iconUrl = input.iconUrl.trim();
    if (iconUrl.length > 2048 || !/^https:\/\//i.test(iconUrl)) return { code: "VALIDATION_ERROR", message: "Community icon must be a valid HTTPS URL." };
  }

  if (input.visibility !== undefined && input.visibility !== "public" && input.visibility !== "private") return { code: "VALIDATION_ERROR", message: "Community visibility must be public or private." };
  if (input.publicReadEnabled !== undefined && typeof input.publicReadEnabled !== "boolean") return { code: "VALIDATION_ERROR", message: "Public read policy must be enabled or disabled." };
  if (input.templateId !== undefined && input.templateId !== null && !isCommunityTemplateId(input.templateId)) return { code: "VALIDATION_ERROR", message: "Choose a supported community template." };

  return null;
}

function validateUpdateInput(input: UpdateCommunityInput): CommunityServiceError | null {
  if (!input.id.trim()) {
    return { code: "VALIDATION_ERROR", message: "Community ID is required." };
  }

  if (input.name !== undefined) {
    const name = cleanName(input.name);

    if (!name) {
      return { code: "VALIDATION_ERROR", message: "Community name is required." };
    }

    if (name.length > 80) {
      return { code: "VALIDATION_ERROR", message: "Community name must be 80 characters or fewer." };
    }
  }

  if (input.description && input.description.length > 500) {
    return { code: "VALIDATION_ERROR", message: "Community description must be 500 characters or fewer." };
  }

  if (input.iconUrl) {
    const iconUrl = input.iconUrl.trim();
    if (iconUrl.length > 2048 || !/^https:\/\//i.test(iconUrl)) return { code: "VALIDATION_ERROR", message: "Community icon must be a valid HTTPS URL." };
  }

  return null;
}

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();

  if (!status.configured) {
    return {
      ok: false as const,
      error: {
        code: "DATA_SOURCE_NOT_CONFIGURED" as const,
        message: status.reason ?? "Supabase data source is not configured.",
      },
    };
  }

  const client = getSupabaseClient();

  if (!client) {
    return {
      ok: false as const,
      error: {
        code: "DATA_SOURCE_NOT_CONFIGURED" as const,
        message: "Supabase client is unavailable.",
      },
    };
  }

  return { ok: true as const, data: client };
}

export const communityService = {
  async listCommunities(): Promise<CommunityServiceResult<CommunitySummary[]>> {
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return { ok: true, data: listMockCommunitySummaries() };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const result = await listSupabaseCommunitySummaries(configured.data);

    if (result.error || !result.data) {
      return { ok: false, error: { code: "COMMUNITY_LIST_FAILED", message: "Could not load communities." } };
    }

    return { ok: true, data: result.data };
  },

  async createCommunity(input: CreateCommunityInput): Promise<CommunityServiceResult<CommunitySummary>> {
    const validationError = validateCreateInput(input);
    if (validationError) return { ok: false, error: validationError };

    const name = cleanName(input.name);
    const kind = input.kind ?? "text";
    const iconUrl = input.iconUrl?.trim() || null;
    const visibility = input.visibility ?? "public";
    const publicReadEnabled = visibility === "public" ? input.publicReadEnabled ?? true : false;
    const creationRequestId = input.creationRequestId?.trim() || crypto.randomUUID();
    const templateId = kind === "text" ? input.templateId ?? "custom" : "custom";
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const existing = mockCommunityCreations.get(creationRequestId);
      if (existing) {
        if (existing.kind !== kind || existing.name !== name || existing.templateId !== templateId) {
          return { ok: false, error: { code: "VALIDATION_ERROR", message: "This creation request was already used for different community details." } };
        }
        return { ok: true, data: existing };
      }
      const now = new Date().toISOString();
      const community: CommunitySummary = {
        id: `mock-community-${creationRequestId}`,
        kind,
        ownerId: "mock-current-user",
        name,
        description: input.description?.trim() || null,
        iconUrl,
        accentColor: input.accentColor ?? "#007571",
        visibility,
        publicReadEnabled,
        rulesEnabled: true,
        rulesVersion: "1",
        templateId,
        createdAt: now,
        updatedAt: now,
      };
      mockCommunityCreations.set(creationRequestId, community);
      return { ok: true, data: community };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data: userData, error: userError } = await configured.data.auth.getUser();
    const userId = userData.user?.id;

    if (userError || !userId) {
      return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in before creating a community." } };
    }

    if (kind === "text") {
      const { data, error } = await configured.data.rpc("create_text_community_with_defaults", {
        target_creation_request_id: creationRequestId,
        community_name: name,
        community_description: input.description?.trim() || null,
        community_icon_url: iconUrl,
        community_accent_color: input.accentColor ?? "#007571",
        community_visibility: visibility,
        community_public_read_enabled: publicReadEnabled,
        community_template_id: templateId,
      });
      const row = data?.[0];
      if (error || !row) {
        return { ok: false, error: { code: "COMMUNITY_TEMPLATE_FAILED", message: "Could not create the Text community and its starter rooms." } };
      }
      return { ok: true, data: { ...mapCommunityListRow(row), templateId } };
    }

    if (kind === "radio") {
      const { data, error } = await configured.data.rpc("create_radio_community_with_defaults", {
        target_creation_request_id: creationRequestId,
        community_name: name,
        community_description: input.description?.trim() || null,
        community_icon_url: iconUrl,
        community_accent_color: input.accentColor ?? "#007571",
        community_visibility: visibility,
        community_public_read_enabled: publicReadEnabled,
      });
      const row = data?.[0];
      if (error || !row) {
        return { ok: false, error: { code: "COMMUNITY_TEMPLATE_FAILED", message: "Could not create the Radio station and its access roles." } };
      }
      return { ok: true, data: mapCommunityListRow(row) };
    }

    if (kind === "podcast") {
      const { data, error } = await configured.data.rpc("create_podcast_community_with_defaults", {
        target_creation_request_id: creationRequestId,
        community_name: name,
        community_description: input.description?.trim() || null,
        community_icon_url: iconUrl,
        community_accent_color: input.accentColor ?? "#007571",
        community_visibility: visibility,
        community_public_read_enabled: publicReadEnabled,
      });
      const row = data?.[0];
      if (error || !row) {
        return { ok: false, error: { code: "COMMUNITY_TEMPLATE_FAILED", message: "Could not create the Podcast library and its publishing roles." } };
      }
      return { ok: true, data: mapCommunityListRow(row) };
    }

    const insertPayload = {
      owner_id: userId,
      name,
      description: input.description?.trim() || null,
      icon_url: iconUrl,
      accent_color: input.accentColor ?? "#007571",
      visibility,
      public_read_enabled: publicReadEnabled,
    };
    const currentResult = await configured.data
      .from("communities")
      .insert({
        ...insertPayload,
        kind,
      })
      .select("id, kind, owner_id, name, description, icon_url, accent_color, visibility, public_read_enabled, rules_enabled, rules_version, created_at, updated_at")
      .single();

    if (!currentResult.error && currentResult.data) {
      return { ok: true, data: mapCommunityListRow(currentResult.data) };
    }

    return { ok: false, error: { code: "COMMUNITY_CREATE_FAILED", message: "Could not create community." } };
  },

  async updateCommunitySettings(input: UpdateCommunityInput): Promise<CommunityServiceResult<CommunitySummary>> {
    const validationError = validateUpdateInput(input);
    if (validationError) return { ok: false, error: validationError };

    const nextName = input.name === undefined ? undefined : cleanName(input.name);
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const now = new Date().toISOString();
      return {
        ok: true,
        data: {
          id: input.id,
          kind: getMockCommunityKind(input.id),
          ownerId: "mock-current-user",
          name: nextName ?? "Mock community",
          description: input.description?.trim() || null,
          iconUrl: input.iconUrl?.trim() || null,
          accentColor: input.accentColor ?? "#007571",
          visibility: input.visibility ?? "public",
          publicReadEnabled: input.visibility === "private" ? false : input.publicReadEnabled ?? true,
          rulesEnabled: false,
          rulesVersion: "1",
          createdAt: now,
          updatedAt: now,
        },
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error } = await configured.data.rpc("update_community_settings", {
      target_community_id: input.id,
      next_name: nextName ?? null,
      next_description: input.description === undefined ? null : input.description?.trim() || null,
      next_icon_url: input.iconUrl === undefined ? null : input.iconUrl?.trim() || null,
      next_visibility: input.visibility ?? null,
      next_public_read_enabled: input.publicReadEnabled ?? null,
    });
    const row = data?.[0];
    if (error || !row) {
      return { ok: false, error: { code: "COMMUNITY_UPDATE_FAILED", message: "Could not update community." } };
    }
    return { ok: true, data: mapCommunityListRow(row) };
  },
};
