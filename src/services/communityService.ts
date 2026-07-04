import { mockCommunities } from "../data/mockCommunities";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

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

export type CommunityServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "COMMUNITY_CREATE_FAILED"
  | "COMMUNITY_LIST_FAILED";

export type CommunityServiceError = Readonly<{
  code: CommunityServiceErrorCode;
  message: string;
}>;

export type CommunityServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: CommunityServiceError }>;

function mapMockCommunity(community: (typeof mockCommunities)[number]): CommunitySummary {
  return {
    id: community.id,
    ownerId: "mock-current-user",
    name: community.name,
    description: null,
    iconUrl: null,
    accentColor: community.accentColor,
    createdAt: null,
    updatedAt: null,
  };
}

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

function mapSupabaseCommunity(row: {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  accent_color: string;
  created_at: string;
  updated_at: string;
}): CommunitySummary {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    iconUrl: row.icon_url,
    accentColor: row.accent_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
      return { ok: true, data: mockCommunities.map(mapMockCommunity) };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const { data, error } = await configured.data
      .from("communities")
      .select("id, owner_id, name, description, icon_url, accent_color, created_at, updated_at")
      .order("created_at", { ascending: true });

    if (error) {
      return { ok: false, error: { code: "COMMUNITY_LIST_FAILED", message: "Could not load communities." } };
    }

    return { ok: true, data: (data ?? []).map(mapSupabaseCommunity) };
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
      .select("id, owner_id, name, description, icon_url, accent_color, created_at, updated_at")
      .single();

    if (error || !data) {
      return { ok: false, error: { code: "COMMUNITY_CREATE_FAILED", message: "Could not create community." } };
    }

    return { ok: true, data: mapSupabaseCommunity(data) };
  },
};