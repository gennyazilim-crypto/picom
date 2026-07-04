import { avatarPack, type AvatarPackUrl } from "../data/avatarPack";
import type { Member, UserId } from "../types/community";

const assignmentKey = "picom-avatar-assignments-v1";

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

function randomIndex(max: number) {
  if (max <= 1) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
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

    const assignments = readAssignments();
    const existing = assignments[member.userId];
    if (existing && isAvatarPackUrl(existing)) return existing;

    const next = avatarPack[randomIndex(avatarPack.length)];
    assignments[member.userId] = next;
    writeAssignments(assignments);
    return next;
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