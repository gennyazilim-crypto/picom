export type RootUserAccountStatus =
  | "active"
  | "limited"
  | "under_review"
  | "suspended"
  | "temporarily_banned"
  | "permanently_banned"
  | "deletion_pending"
  | "deleted";

export type RootUserEmailStatus =
  | "verified"
  | "unverified"
  | "pending"
  | "delivery_failed"
  | "invalid";

export type RootUserRisk = "none" | "low" | "medium" | "high" | "critical";

export type RootUserFilters = {
  search: string;
  status: string;
  emailStatus: string;
  role: string;
  risk: string;
  platform: string;
  createdFrom: string;
  createdTo: string;
  lastSeen: string;
  sort: "created_at" | "last_seen_at" | "status" | "display_name";
  direction: "asc" | "desc";
  page: number;
  pageSize: 25 | 50 | 100;
  includeDeleted: boolean;
};

export type RootUserListItem = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  email: string;
  emailStatus: RootUserEmailStatus;
  accountStatus: RootUserAccountStatus;
  role: string;
  risk: RootUserRisk;
  mfaEnabled: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  platform: string;
};

export type RootUserSummary = {
  total: number;
  active: number;
  unverified: number;
  suspended: number;
  temporarilyBanned: number;
  permanentlyBanned: number;
  registered24h: number;
  active7d: number;
  deletionPending: number;
};

export type RootUserCapabilities = {
  canViewFullEmail: boolean;
  canWrite: boolean;
  canManageRoles: boolean;
  canExport: boolean;
  canPermanentlyDelete: boolean;
};

export type RootUserListResponse = {
  items: RootUserListItem[];
  total: number;
  summary: RootUserSummary;
  capabilities: RootUserCapabilities;
  checkedAt: string;
};

export type RootUserDetailTab =
  | "overview"
  | "account"
  | "security"
  | "sessions"
  | "roles"
  | "content"
  | "communities"
  | "dm-safety"
  | "moderation"
  | "emails"
  | "notifications"
  | "audit";

export type RootUserDetail = {
  user: RootUserListItem;
  auth: {
    provider: string;
    emailConfirmedAt: string | null;
    lastSignInAt: string | null;
  };
  account: {
    updatedAt: string | null;
    onboardingCompleted: boolean;
    deletionRequestedAt: string | null;
  };
  security: {
    mfaFactorCount: number;
    activeSessionCount: number;
    riskLevel: RootUserRisk;
  };
  sessions: Array<Record<string, unknown>>;
  roles: Array<Record<string, unknown>>;
  securityFlags: Array<Record<string, unknown>>;
  restrictions: Array<Record<string, unknown>>;
  bans: Array<Record<string, unknown>>;
  tags: Array<Record<string, unknown>>;
  communities: Array<Record<string, unknown>>;
  content: Record<string, number>;
  dmSafety: Record<string, unknown>;
  emails: Array<Record<string, unknown>>;
  notifications: Record<string, unknown>;
  audit: Array<Record<string, unknown>>;
};

export type RootUserAction =
  | "manual_verify_email"
  | "resend_verification"
  | "send_password_reset"
  | "revoke_sessions"
  | "reset_mfa"
  | "set_under_review"
  | "limit_account"
  | "suspend"
  | "temporary_ban"
  | "permanent_ban"
  | "unban"
  | "reactivate"
  | "add_restriction"
  | "remove_restriction"
  | "assign_role"
  | "add_tag"
  | "start_deletion"
  | "permanent_delete"
  | "export_user"
  | "export_selection";

export type RootUserActionRequest = {
  action: RootUserAction;
  targetUserIds: string[];
  reason?: string;
  expiresAt?: string;
  restriction?: string;
  roleKey?: string;
  tag?: string;
  confirmation?: string;
  confirmEmail?: string;
};

export type RootUserActionResult = {
  success: boolean;
  message: string;
  requestId?: string;
  download?: {
    fileName: string;
    mimeType: string;
    content: string;
  };
};
