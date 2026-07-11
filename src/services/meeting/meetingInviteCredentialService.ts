import { meetingSchedulingService } from "./meetingSchedulingService";

type CredentialResult = Readonly<{ ok: true } | { ok: false; code: string; message: string }>;
let pending: Readonly<{ roomId: string; token: string }> | null = null;

const inviteMessage = (code: string): string => {
  const normalized = code.toUpperCase();
  if (normalized.includes("EXPIRED")) return "This meeting invite expired.";
  if (normalized.includes("REVOKED")) return "This meeting invite was revoked.";
  if (normalized.includes("EXHAUSTED")) return "This meeting invite reached its use limit.";
  return "This meeting invite is no longer valid.";
};

export const meetingInviteCredentialService = {
  set(roomId: string, token: string): void { pending = { roomId, token }; },
  clear(): void { pending = null; },
  async redeem(roomId: string): Promise<CredentialResult> {
    if (!pending) return { ok: true };
    const credential = pending;
    pending = null;
    if (credential.roomId !== roomId) return { ok: false, code: "INVITE_ROOM_MISMATCH", message: "This invite belongs to another meeting." };
    const result = await meetingSchedulingService.validateInvite(roomId, credential.token, true);
    if (!result.ok) return { ok: false, code: result.error.code, message: result.error.message };
    return result.data.valid ? { ok: true } : { ok: false, code: result.data.code, message: inviteMessage(result.data.code) };
  },
};
