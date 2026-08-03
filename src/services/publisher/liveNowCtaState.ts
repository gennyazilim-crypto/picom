import type { CanStartPicomLiveStream, PublisherProgramState } from "./publisherProgramTypes";

/** Live Now header CTA state machine (server `ctaState` + Go Live preflight). */
export type LiveNowCtaState =
  | "threshold_not_met"
  | "eligible_not_applied"
  | "draft"
  | "submitted"
  | "under_review"
  | "additional_information_required"
  | "approved_active"
  | "suspended"
  | "rejected"
  | "revoked";

export type LiveNowCtaAction =
  | { kind: "link"; key: "requirements" | "apply" | "complete_application" | "complete_info" | "dashboard" | "view_decision"; route: string }
  | { kind: "go_live"; enabled: boolean }
  | { kind: "status_chip"; key: "under_review" }
  | { kind: "account_message"; key: "suspended" | "revoked" };

const VALID_STATES: readonly LiveNowCtaState[] = [
  "threshold_not_met",
  "eligible_not_applied",
  "draft",
  "submitted",
  "under_review",
  "additional_information_required",
  "approved_active",
  "suspended",
  "rejected",
  "revoked",
];

export function normalizeLiveNowCtaState(value: unknown): LiveNowCtaState {
  return typeof value === "string" && (VALID_STATES as readonly string[]).includes(value)
    ? (value as LiveNowCtaState)
    : "threshold_not_met";
}

/**
 * Derive CTA actions from server program state + Go Live preflight.
 * UI visibility is never treated as authorization — Go Live stays disabled unless preflight.allowed.
 */
export function resolveLiveNowCtaActions(
  state: LiveNowCtaState,
  preflight: Pick<CanStartPicomLiveStream, "allowed"> | null,
): readonly LiveNowCtaAction[] {
  switch (state) {
    case "threshold_not_met":
      return [{ kind: "link", key: "requirements", route: "/publisher/apply" }];
    case "eligible_not_applied":
      return [{ kind: "link", key: "apply", route: "/publisher/apply" }];
    case "draft":
      return [{ kind: "link", key: "complete_application", route: "/publisher/apply" }];
    case "submitted":
    case "under_review":
      return [{ kind: "status_chip", key: "under_review" }];
    case "additional_information_required":
      return [{ kind: "link", key: "complete_info", route: "/publisher/apply" }];
    case "approved_active":
      return [
        { kind: "link", key: "dashboard", route: "/publisher/dashboard" },
        { kind: "go_live", enabled: Boolean(preflight?.allowed) },
      ];
    case "suspended":
      return [{ kind: "account_message", key: "suspended" }];
    case "revoked":
      return [{ kind: "account_message", key: "revoked" }];
    case "rejected":
      return [{ kind: "link", key: "view_decision", route: "/publisher/apply" }];
    default:
      return [{ kind: "link", key: "requirements", route: "/publisher/apply" }];
  }
}

export function resolveCtaStateFromProgram(program: PublisherProgramState | null): LiveNowCtaState {
  if (!program) return "threshold_not_met";
  if (program.ctaState) return normalizeLiveNowCtaState(program.ctaState);
  if (program.canBroadcast && program.profile?.status === "active" && program.activeBadge?.status === "active") {
    return "approved_active";
  }
  if (program.eligibility?.eligible) return "eligible_not_applied";
  return "threshold_not_met";
}
