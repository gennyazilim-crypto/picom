import type { AdminOperationsAccess } from "../adminOperationsService";
import { rootDashboardMutationService } from "./rootDashboardMutationService";
import type { AdminOperationsResult } from "../../types/adminOperations";
import type { RootDashboardMutationOk } from "../../types/rootDashboardOperations";

/**
 * Runs a privileged dashboard mutation with MFA/step-up challenge flow.
 * Server raises STEP_UP_REQUIRED until a confirmed challenge exists.
 */
export async function withPrivilegedStepUp(
  access: AdminOperationsAccess,
  actionKey: string,
  run: (challengeId: string | null) => Promise<AdminOperationsResult<RootDashboardMutationOk>>,
): Promise<AdminOperationsResult<RootDashboardMutationOk>> {
  const first = await run(null);
  if (first.ok) return first;

  const needsStepUp = /STEP_UP_REQUIRED/i.test(first.message);
  if (!needsStepUp) return first;

  const challenge = await rootDashboardMutationService.createPrivilegedStepUp(access, actionKey);
  if (!challenge.ok) {
    return { ok: false, message: `Step-up required but could not create challenge: ${challenge.message}` };
  }

  const challengeId = challenge.data.id;
  if (!challengeId) {
    return { ok: false, message: "Step-up challenge did not return an id." };
  }

  const confirmed = await rootDashboardMutationService.confirmPrivilegedStepUp(access, challengeId);
  if (!confirmed.ok) {
    return { ok: false, message: `Step-up confirmation failed: ${confirmed.message}` };
  }

  return run(challengeId);
}
