import { avatarPack, type AvatarPackUrl } from "../data/avatarPack";
import type { Member, UserId } from "../types/community";

/** v2 stores only explicit pack picks; auto fallbacks are deterministic from userId. */
const assignmentKey = "picom-avatar-assignments-v2";

type AvatarAssignments = Record<UserId, AvatarPackUrl>;

function readAssignments(): AvatarAssignments {
  try {
    const raw = localStorage.getItem(assignmentKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AvatarAssignments;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAssignments(assignments: AvatarAssignments) {
  try {
    localStorage.setItem(assignmentKey, JSON.stringify(assignments));
  } catch {
    // Avatar persistence is a convenience fallback and must never break the UI.
  }
}

/** Stable pack index from user id so every client shows the same auto avatar. */
function deterministicIndex(seed: string, max: number) {
  if (max <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % max;
}

function isAvatarPackUrl(value: string): value is AvatarPackUrl {
  return (avatarPack as readonly string[]).includes(value);
}

export const avatarService = {
  getAvailableAvatars() {
    return [...avatarPack];
  },

  getAvatarForMember(member?: Pick<Member, "userId" | "avatarUrl" | "avatarSeed">) {
    if (!member) return undefined;
    if (member.avatarUrl) return member.avatarUrl;

    // Explicit pack picks (settings / onboarding) stay local until a profile photo exists.
    if (member.userId) {
      const existing = readAssignments()[member.userId];
      if (existing && isAvatarPackUrl(existing)) return existing;
    }

    const seed = member.userId || member.avatarSeed || "";
    if (!seed) return undefined;
    return avatarPack[deterministicIndex(seed, avatarPack.length)];
  },

  setAvatarForUser(userId: UserId, avatarUrl: AvatarPackUrl) {
    const assignments = readAssignments();
    assignments[userId] = avatarUrl;
    writeAssignments(assignments);
    return avatarUrl;
  },

  clearAvatarForUser(userId: UserId) {
    const assignments = readAssignments();
    delete assignments[userId];
    writeAssignments(assignments);
  },
};
