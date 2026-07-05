export function isInviteExpired(invite, now = new Date()) {
  if (!invite || invite.revokedAt) {
    return false;
  }

  if (!invite.expiresAt) {
    return false;
  }

  const expiresAt = new Date(invite.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  return expiresAt.getTime() <= now.getTime();
}

export async function cleanupExpiredInvites(options = {}) {
  const {
    invites = [],
    now = new Date(),
    dryRun = true,
    markRevoked,
    logger = console,
  } = options;

  const summary = {
    ok: true,
    dryRun,
    scanned: invites.length,
    expired: 0,
    revoked: 0,
    errors: [],
  };

  for (const invite of invites) {
    if (!isInviteExpired(invite, now)) {
      continue;
    }

    summary.expired += 1;

    if (dryRun) {
      continue;
    }

    if (typeof markRevoked !== "function") {
      summary.errors.push({
        inviteId: invite.id ?? "unknown",
        reason: "MARK_REVOKED_ADAPTER_MISSING",
      });
      continue;
    }

    try {
      await markRevoked(invite, now);
      summary.revoked += 1;
    } catch (error) {
      summary.errors.push({
        inviteId: invite.id ?? "unknown",
        reason: error instanceof Error ? error.message : "UNKNOWN_REVOKE_ERROR",
      });
    }
  }

  logger.info?.("Expired invites cleanup summary", {
    dryRun: summary.dryRun,
    scanned: summary.scanned,
    expired: summary.expired,
    revoked: summary.revoked,
    errors: summary.errors.length,
  });

  return summary;
}
