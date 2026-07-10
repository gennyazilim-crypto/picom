export type CommunityRule = Readonly<{
  id: string;
  communityId: string;
  title: string;
  body: string;
  position: number;
  required: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type CommunityRulesAcceptance = Readonly<{
  communityId: string;
  userId: string;
  rulesAcceptedAt: string | null;
  rulesVersion: string | null;
}>;

export type CommunityRulesAcceptanceInput = Readonly<{
  rulesVersion: string;
  acceptedAt: string;
}>;

export type CommunityRulesSummary = Readonly<{
  communityId: string;
  requiredRuleCount: number;
  accepted: boolean;
  acceptedAt: string | null;
  acceptedVersion: string | null;
}>;
