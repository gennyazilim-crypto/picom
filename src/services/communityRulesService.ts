import type { CommunityRule, CommunityRulesAcceptance, CommunityRulesSummary } from "../types/communityRules";
import { loggingService } from "./loggingService";

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

function readAcceptanceRecords(): Record<string, string> {
  const storage = getLocalStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, string> : {};
  } catch {
    loggingService.logWarn("Community rules acceptance cache reset", undefined, "community-rules");
    return {};
  }
}

function writeAcceptanceRecords(records: Record<string, string>): void {
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

  getAcceptance(communityId: string, userId: string): CommunityRulesAcceptance {
    const records = readAcceptanceRecords();

    return {
      communityId,
      userId,
      rulesAcceptedAt: records[acceptanceKey(communityId, userId)] ?? null
    };
  },

  acceptRules(communityId: string, userId: string): CommunityRulesAcceptance {
    const records = readAcceptanceRecords();
    const acceptedAt = now();
    records[acceptanceKey(communityId, userId)] = acceptedAt;
    writeAcceptanceRecords(records);

    loggingService.logInfo("Community rules accepted locally", {
      communityId,
      acceptedAt
    }, "community-rules");

    return {
      communityId,
      userId,
      rulesAcceptedAt: acceptedAt
    };
  },

  getSummary(communityId: string, userId: string): CommunityRulesSummary {
    const rules = this.getDefaultRules(communityId);
    const acceptance = this.getAcceptance(communityId, userId);

    return {
      communityId,
      requiredRuleCount: rules.filter((rule) => rule.required).length,
      accepted: Boolean(acceptance.rulesAcceptedAt),
      acceptedAt: acceptance.rulesAcceptedAt
    };
  },

  resetLocalAcceptance(communityId: string, userId: string): void {
    const records = readAcceptanceRecords();
    delete records[acceptanceKey(communityId, userId)];
    writeAcceptanceRecords(records);
  }
};
