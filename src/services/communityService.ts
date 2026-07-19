import { secretCommunityService } from "./community/secretCommunityService";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import { COMMUNITY_LIST_SELECT, getMockCommunityKind, listMockCommunitySummaries, listSupabaseCommunitySummaries, mapCommunityListRow } from "./communityListQuery";
import { isCommunityTemplateId } from "../data/communityTemplates";
import { isCommunityKind, type CommunityKind } from "../types/community";
import type { CommunityRule } from "../types/communityRules";
import { getDefaultCommunityTypeSettings, isValidCommunityTypeSettings, type CommunityNotificationLevel, type CommunityTypeSettings } from "../types/communitySettings";
import { communityRulesService } from "./communityRulesService";

export type CommunitySummary = Readonly<{
  id: string;
  kind: CommunityKind;
  ownerId: string | null;
  name: string;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  accentColor: string;
  visibility: "public" | "private" | "secret";
  publicReadEnabled: boolean;
  defaultNotificationLevel: CommunityNotificationLevel;
  typeSettings: CommunityTypeSettings;
  rulesEnabled: boolean;
  rulesVersion: string;
  discoveryListed?: boolean;
  discoveryCategory?: "development" | "design" | "gaming" | "music" | "study" | "work" | null;
  discoveryJoinPolicy?: "open" | "request";
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
  bannerUrl?: string | null;
  accentColor?: string;
  visibility?: "public" | "private" | "secret";
  publicReadEnabled?: boolean;
  defaultNotificationLevel?: CommunityNotificationLevel;
  rulesEnabled?: boolean;
  rulesVersion?: string;
  typeSettings?: CommunityTypeSettings;
  rules?: readonly CommunityRule[];
  templateId?: string | null;
}>;

export type UpdateCommunityInput = Readonly<{
  id: string;
  name?: string;
  description?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  accentColor?: string;
  visibility?: "public" | "private" | "secret";
  publicReadEnabled?: boolean;
  defaultNotificationLevel?: CommunityNotificationLevel;
  rulesEnabled?: boolean;
  rulesVersion?: string;
  typeSettings?: CommunityTypeSettings;
  rules?: readonly CommunityRule[];
}>;

export type CommunityServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "COMMUNITY_CREATE_FAILED"
  | "COMMUNITY_TEMPLATE_FAILED"
  | "COMMUNITY_UPDATE_FAILED"
  | "COMMUNITY_KIND_LOOKUP_FAILED"
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

function isSafeBrandUrl(value: string): boolean {
  if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    // Local Supabase storage serves http://127.0.0.1 / localhost.
    if (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) return true;
    return false;
  } catch {
    return false;
  }
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
    if ((!iconUrl.startsWith("data:image/") && iconUrl.length > 2048) || !isSafeBrandUrl(iconUrl)) return { code: "VALIDATION_ERROR", message: "Community icon must be a controlled HTTPS image upload." };
  }

  if (input.bannerUrl) {
    const bannerUrl = input.bannerUrl.trim();
    if ((!bannerUrl.startsWith("data:image/") && bannerUrl.length > 2048) || !isSafeBrandUrl(bannerUrl)) return { code: "VALIDATION_ERROR", message: "Community banner must be a controlled HTTPS image upload." };
  }

  if (input.defaultNotificationLevel && !["all", "mentions", "none"].includes(input.defaultNotificationLevel)) return { code: "VALIDATION_ERROR", message: "Choose a supported default notification level." };
  if (input.typeSettings && !isValidCommunityTypeSettings(input.typeSettings.kind, input.typeSettings)) return { code: "VALIDATION_ERROR", message: "Community type settings are invalid." };
  if (input.rulesVersion !== undefined && !/^[a-zA-Z0-9._-]{1,32}$/.test(input.rulesVersion)) return { code: "VALIDATION_ERROR", message: "Rules version must use 1-32 safe characters." };
  if (input.rules && (input.rules.length > 10 || input.rules.some((rule) => !rule.title.trim() || rule.title.trim().length > 120 || !rule.body.trim() || rule.body.trim().length > 2000))) return { code: "VALIDATION_ERROR", message: "Add up to 10 complete rules with valid titles and text." };
  if (input.rulesEnabled && !input.rules?.length) return { code: "VALIDATION_ERROR", message: "Publish at least one rule before requiring acceptance." };

  if (input.visibility !== undefined && input.visibility !== "public" && input.visibility !== "private" && input.visibility !== "secret") return { code: "VALIDATION_ERROR", message: "Community visibility must be public, private, or secret." };
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
    if ((!iconUrl.startsWith("data:image/") && iconUrl.length > 2048) || !isSafeBrandUrl(iconUrl)) return { code: "VALIDATION_ERROR", message: "Community icon must be a controlled HTTPS image upload." };
  }

  if (input.bannerUrl) {
    const bannerUrl = input.bannerUrl.trim();
    if ((!bannerUrl.startsWith("data:image/") && bannerUrl.length > 2048) || !isSafeBrandUrl(bannerUrl)) return { code: "VALIDATION_ERROR", message: "Community banner must be a controlled HTTPS image upload." };
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
  async getCommunityKind(communityId: string): Promise<CommunityServiceResult<CommunityKind>> {
    const dataSource = dataSourceService.getStatus();
    if (dataSource.isMock) {
      const created = [...mockCommunityCreations.values()].find((community) => community.id === communityId);
      return { ok: true, data: created?.kind ?? getMockCommunityKind(communityId) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;
    const result = await configured.data.from("communities").select("kind").eq("id", communityId).maybeSingle();
    if (result.error || !result.data || !isCommunityKind(result.data.kind)) {
      return { ok: false, error: { code: "COMMUNITY_KIND_LOOKUP_FAILED", message: "Community type is unavailable or not visible to you." } };
    }
    return { ok: true, data: result.data.kind };
  },

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

    if (visibility === "secret") {
      const result = await secretCommunityService.createCommunity({
        creationRequestId,
        kind,
        name,
        description: input.description?.trim() || undefined,
        iconUrl: iconUrl ?? undefined,
        accentColor: input.accentColor,
        templateId,
      });
      if (!result.ok) {
        return { ok: false, error: { code: "COMMUNITY_CREATE_FAILED", message: result.error.message } };
      }
      return result;
    }

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
        bannerUrl: null,
        accentColor: input.accentColor ?? "#007571",
        visibility,
        publicReadEnabled,
        defaultNotificationLevel: "mentions",
        typeSettings: getDefaultCommunityTypeSettings(kind),
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
      .select("id, kind, owner_id, name, description, icon_url, banner_url, accent_color, visibility, public_read_enabled, default_notification_level, type_settings, rules_enabled, rules_version, created_at, updated_at")
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
      const kind = input.typeSettings?.kind ?? getMockCommunityKind(input.id);
      if (input.rules) communityRulesService.saveMockRules(input.id, input.rules);
      return {
        ok: true,
        data: {
          id: input.id,
          kind,
          ownerId: "mock-current-user",
          name: nextName ?? "Mock community",
          description: input.description === undefined ? null : input.description?.trim() || null,
          iconUrl: input.iconUrl === undefined ? null : input.iconUrl?.trim() || null,
          bannerUrl: input.bannerUrl === undefined ? null : input.bannerUrl?.trim() || null,
          accentColor: input.accentColor ?? "#007571",
          visibility: input.visibility ?? "public",
          publicReadEnabled: input.visibility !== "public" ? false : input.publicReadEnabled ?? true,
          defaultNotificationLevel: input.defaultNotificationLevel ?? "mentions",
          typeSettings: input.typeSettings ?? getDefaultCommunityTypeSettings(kind),
          rulesEnabled: input.rulesEnabled ?? false,
          rulesVersion: input.rulesVersion ?? "1",
          createdAt: now,
          updatedAt: now,
        },
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    // RPC requires a full settings payload. Merge partial updates (e.g. icon-only after create)
    // with the current row so we do not wipe name/rules or fail validation.
    const currentResult = await configured.data
      .from("communities")
      .select(COMMUNITY_LIST_SELECT)
      .eq("id", input.id)
      .maybeSingle();
    if (currentResult.error || !currentResult.data) {
      return { ok: false, error: { code: "COMMUNITY_UPDATE_FAILED", message: "Could not update community." } };
    }
    const current = mapCommunityListRow(currentResult.data);

    let nextRules = input.rules;
    if (nextRules === undefined) {
      const loaded = await communityRulesService.loadPublishedRules(input.id);
      if (!loaded.ok) {
        return { ok: false, error: { code: "COMMUNITY_UPDATE_FAILED", message: "Could not update community." } };
      }
      nextRules = loaded.rules;
    }

    const mergedName = nextName ?? current.name;
    const mergedDescription = input.description === undefined ? current.description : input.description?.trim() || null;
    const mergedIconUrl = input.iconUrl === undefined ? current.iconUrl : input.iconUrl?.trim() || null;
    const mergedBannerUrl = input.bannerUrl === undefined ? current.bannerUrl : input.bannerUrl?.trim() || null;
    const mergedVisibility = input.visibility ?? current.visibility;
    const mergedPublicRead = input.publicReadEnabled ?? current.publicReadEnabled;
    const mergedNotification = input.defaultNotificationLevel ?? current.defaultNotificationLevel;
    const mergedRulesEnabled = input.rulesEnabled ?? current.rulesEnabled;
    const mergedRulesVersion = input.rulesVersion ?? current.rulesVersion;
    const mergedTypeSettings = input.typeSettings ?? current.typeSettings;

    const { data, error } = await configured.data.rpc(mergedVisibility === "secret" ? "update_secret_community_settings" : "update_community_settings", {
      target_community_id: input.id,
      next_name: mergedName,
      next_description: mergedDescription,
      next_icon_url: mergedIconUrl,
      next_banner_url: mergedBannerUrl,
      next_visibility: mergedVisibility,
      next_public_read_enabled: mergedPublicRead,
      next_default_notification_level: mergedNotification,
      next_rules_enabled: mergedRulesEnabled,
      next_rules_version: mergedRulesVersion,
      next_type_settings: mergedTypeSettings,
      next_rules: nextRules.map((rule) => ({ title: rule.title.trim(), body: rule.body.trim(), required: rule.required })),
    });
    const row = data?.[0];
    if (error || !row) {
      return { ok: false, error: { code: "COMMUNITY_UPDATE_FAILED", message: "Could not update community." } };
    }
    return { ok: true, data: mapCommunityListRow(row) };
  },
};
