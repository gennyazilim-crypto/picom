import type { CommunityRule, CommunityRulesAcceptance, CommunityRulesSummary } from "../types/communityRules";
import { dataSourceService } from "./dataSourceService";
import { loggingService } from "./loggingService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const storageKey = "picom.communityRules.acceptance.v1";

function now(): string {
  return new Date().toISOString();
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

type StoredAcceptance = Readonly<{ acceptedAt: string; rulesVersion: string }>;

function readAcceptanceRecords(): Record<string, StoredAcceptance> {
  const storage = getLocalStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) => {
      if (typeof value === "string") return [[key, { acceptedAt: value, rulesVersion: "legacy" }]];
      if (!value || typeof value !== "object") return [];
      const candidate = value as Partial<StoredAcceptance>;
      return typeof candidate.acceptedAt === "string" && typeof candidate.rulesVersion === "string"
        ? [[key, { acceptedAt: candidate.acceptedAt, rulesVersion: candidate.rulesVersion }]]
        : [];
    }));
  } catch {
    loggingService.logWarn("Community rules acceptance cache reset", undefined, "community-rules");
    return {};
  }
}

function writeAcceptanceRecords(records: Record<string, StoredAcceptance>): void {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(storageKey, JSON.stringify(records));
  } catch {
    loggingService.logWarn("Community rules acceptance cache write failed", undefined, "community-rules");
  }
}

function acceptanceKey(communityId: string, userId: string): string {
  return `${communityId}:${userId}`;
}

export const communityRulesService = {
  getDefaultRules(communityId: string): CommunityRule[] {
    const timestamp = "2026-01-01T00:00:00.000Z";

    return [
      {
        id: `${communityId}-rule-kindness`,
        communityId,
        title: "Keep conversations respectful",
        body: "Treat people with care, avoid harassment, and keep disagreements constructive.",
        position: 0,
        required: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: `${communityId}-rule-safety`,
        communityId,
        title: "Protect private information",
        body: "Do not share passwords, tokens, private keys, personal data, or screenshots with sensitive details.",
        position: 1,
        required: true,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: `${communityId}-rule-focus`,
        communityId,
        title: "Use the right channel",
        body: "Post in the most relevant channel so members can follow projects, help requests, and announcements clearly.",
        position: 2,
        required: false,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];
  },

  async loadPublishedRules(communityId: string): Promise<{ ok: true; rules: CommunityRule[] } | { ok: false; message: string }> {
    if (dataSourceService.getStatus().isMock) return { ok: true, rules: this.getDefaultRules(communityId) };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Community rules are unavailable. Try again later." };
    const { data, error } = await client.from("community_rules").select("id, community_id, title, body, position, required, created_at, updated_at").eq("community_id", communityId).eq("published", true).order("position", { ascending: true });
    if (error) {
      loggingService.logWarn("Community rules could not be loaded", { communityId }, "community-rules");
      return { ok: false, message: "Community rules could not be loaded. Joining is paused for safety." };
    }
    return { ok: true, rules: (data ?? []).map((row) => ({ id: row.id, communityId: row.community_id, title: row.title, body: row.body, position: row.position, required: row.required, createdAt: row.created_at, updatedAt: row.updated_at })) };
  },

  getAcceptance(communityId: string, userId: string): CommunityRulesAcceptance {
    const records = readAcceptanceRecords();

    return {
      communityId,
      userId,
      rulesAcceptedAt: records[acceptanceKey(communityId, userId)]?.acceptedAt ?? null,
      rulesVersion: records[acceptanceKey(communityId, userId)]?.rulesVersion ?? null
    };
  },

  acceptRules(communityId: string, userId: string, rulesVersion = "1", acceptedAt = now()): CommunityRulesAcceptance {
    const records = readAcceptanceRecords();
    records[acceptanceKey(communityId, userId)] = { acceptedAt, rulesVersion };
    writeAcceptanceRecords(records);

    loggingService.logInfo("Community rules accepted locally", {
      communityId,
      acceptedAt
    }, "community-rules");

    return {
      communityId,
      userId,
      rulesAcceptedAt: acceptedAt,
      rulesVersion
    };
  },

  getSummary(communityId: string, userId: string): CommunityRulesSummary {
    const rules = this.getDefaultRules(communityId);
    const acceptance = this.getAcceptance(communityId, userId);

    return {
      communityId,
      requiredRuleCount: rules.filter((rule) => rule.required).length,
      accepted: Boolean(acceptance.rulesAcceptedAt),
      acceptedAt: acceptance.rulesAcceptedAt,
      acceptedVersion: acceptance.rulesVersion
    };
  },

  resetLocalAcceptance(communityId: string, userId: string): void {
    const records = readAcceptanceRecords();
    delete records[acceptanceKey(communityId, userId)];
    writeAcceptanceRecords(records);
  }
};
