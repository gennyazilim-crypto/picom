import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import { listMockCommunitySummaries, listSupabaseCommunitySummaries, mapCommunityListRow, COMMUNITY_LIST_SELECT } from "./communityListQuery";

export type CommunitySummary = Readonly<{
  id: string;
  ownerId: string | null;
  name: string;
  description: string | null;
  iconUrl: string | null;
  accentColor: string;
  createdAt: string | null;
  updatedAt: string | null;
}>;

export type CreateCommunityInput = Readonly<{
  name: string;
  description?: string | null;
  accentColor?: string;
}>;

export type UpdateCommunityInput = Readonly<{
  id: string;
  name?: string;
  description?: string | null;
  accentColor?: string;
}>;

export type CommunityServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "COMMUNITY_CREATE_FAILED"
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

function validateCreateInput(input: CreateCommunityInput): CommunityServiceError | null {
  const name = cleanName(input.name);

  if (!name) {
    return { code: "VALIDATION_ERROR", message: "Community name is required." };
  }

  if (name.length > 80) {
    return { code: "VALIDATION_ERROR", message: "Community name must be 80 characters or fewer." };
  }

  if (input.description && input.description.length > 500) {
    return { code: "VALIDATION_ERROR", message: "Community description must be 500 characters or fewer." };
  }

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
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const now = new Date().toISOString();
      return {
        ok: true,
        data: {
          id: `mock-community-${Date.now()}`,
          ownerId: "mock-current-user",
          name,
          description: input.description?.trim() || null,
          iconUrl: null,
          accentColor: input.accentColor ?? "#007571",
          createdAt: now,
          updatedAt: now,
        },
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data: userData, error: userError } = await configured.data.auth.getUser();
    const userId = userData.user?.id;

    if (userError || !userId) {
      return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in before creating a community." } };
    }

    const { data, error } = await configured.data
      .from("communities")
      .insert({
        owner_id: userId,
        name,
        description: input.description?.trim() || null,
        accent_color: input.accentColor ?? "#007571",
      })
      .select(COMMUNITY_LIST_SELECT)
      .single();

    if (error || !data) {
      return { ok: false, error: { code: "COMMUNITY_CREATE_FAILED", message: "Could not create community." } };
    }

    return { ok: true, data: mapCommunityListRow(data) };
  },

  async updateCommunityPlaceholder(input: UpdateCommunityInput): Promise<CommunityServiceResult<CommunitySummary>> {
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
          ownerId: "mock-current-user",
          name: nextName ?? "Mock community",
          description: input.description?.trim() || null,
          iconUrl: null,
          accentColor: input.accentColor ?? "#007571",
          createdAt: now,
          updatedAt: now,
        },
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const updatePayload: { name?: string; description?: string | null; accent_color?: string } = {};
    if (nextName !== undefined) updatePayload.name = nextName;
    if (input.description !== undefined) updatePayload.description = input.description?.trim() || null;
    if (input.accentColor !== undefined) updatePayload.accent_color = input.accentColor;

    const { data, error } = await configured.data
      .from("communities")
      .update(updatePayload)
      .eq("id", input.id)
      .select(COMMUNITY_LIST_SELECT)
      .single();

    if (error || !data) {
      return { ok: false, error: { code: "COMMUNITY_UPDATE_FAILED", message: "Could not update community." } };
    }

    return { ok: true, data: mapCommunityListRow(data) };
  },
};