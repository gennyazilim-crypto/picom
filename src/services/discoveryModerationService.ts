import { currentUserId, mockCommunities } from "../data/mockCommunities";
import { auditLogService } from "./auditLogService";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type DiscoveryReviewStatus = "pending" | "approved" | "rejected" | "hidden" | "suspended";
export type DiscoveryReviewItem = Readonly<{
  communityId: string;
  communityName: string;
  description: string;
  iconUrl?: string;
  category: string;
  contentFlags: string[];
  status: DiscoveryReviewStatus;
  reportCount: number;
  submittedAt: string;
  reviewedAt: string | null;
}>;

type ModerationResult<T> = Readonly<{ ok: true; data: T } | { ok: false; message: string }>;
const STORAGE_KEY = "picom.discoveryReviews.mock.v1";

function readMockStatuses(): Record<string, DiscoveryReviewStatus> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, DiscoveryReviewStatus> : {};
  } catch { return {}; }
}

function writeMockStatuses(value: Record<string, DiscoveryReviewStatus>): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* restricted fallback */ }
}

function listMockQueue(statusFilter: DiscoveryReviewStatus | null): DiscoveryReviewItem[] {
  const statuses = readMockStatuses();
  return mockCommunities
    .filter((community) => community.visibility === "public" && community.discoveryListed !== false)
    .map((community, index): DiscoveryReviewItem => ({
      communityId: community.id,
      communityName: community.name,
      description: community.description ?? "Public community profile awaiting review.",
      iconUrl: undefined,
      category: community.discoveryCategory ?? "work",
      contentFlags: [],
      status: statuses[community.id] ?? (index === 0 ? "approved" : "pending"),
      reportCount: 0,
      submittedAt: "2026-07-10T08:00:00.000Z",
      reviewedAt: statuses[community.id] && statuses[community.id] !== "pending" ? new Date().toISOString() : null,
    }))
    .filter((item) => !statusFilter || item.status === statusFilter);
}

export const discoveryModerationService = {
  async listQueue(statusFilter: DiscoveryReviewStatus | null = null): Promise<ModerationResult<DiscoveryReviewItem[]>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: listMockQueue(statusFilter) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Discovery review is unavailable." };
    const { data, error } = await client.rpc("list_discovery_review_queue", { status_filter: statusFilter, result_limit: 100 });
    if (error) return { ok: false, message: "Picom could not load the discovery review queue." };
    return { ok: true, data: (data ?? []).map((row) => ({ communityId: row.community_id, communityName: row.community_name, description: row.description ?? "", iconUrl: row.icon_url ?? undefined, category: row.category ?? "uncategorized", contentFlags: row.content_flags ?? [], status: row.review_status, reportCount: Number(row.report_count) || 0, submittedAt: row.submitted_at, reviewedAt: row.reviewed_at })) };
  },

  async review(communityId: string, status: DiscoveryReviewStatus, reason: string): Promise<ModerationResult<DiscoveryReviewStatus>> {
    if (dataSourceService.getStatus().isMock) {
      const statuses = readMockStatuses();
      writeMockStatuses({ ...statuses, [communityId]: status });
      await auditLogService.append({ communityId, actorId: currentUserId, actionType: "discovery_review", targetType: "community_discovery_listing", targetId: communityId, reason: `Discovery listing marked ${status}${reason.trim() ? `: ${reason.trim().slice(0, 300)}` : ""}` });
      return { ok: true, data: status };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Discovery review is unavailable." };
    const { data, error } = await client.rpc("review_discovery_listing", { target_community_id: communityId, next_status: status, review_reason: reason.trim().slice(0, 500) || null });
    return error || !data ? { ok: false, message: "Picom could not update this discovery review." } : { ok: true, data: status };
  },
};
