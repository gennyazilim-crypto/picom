import type { ISODateString, UserStatus, UUIDString } from "../types/common";

export type MemberDTO = Readonly<{
  id: UUIDString;
  communityId: UUIDString;
  userId: UUIDString;
  roleId: UUIDString;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  status?: UserStatus;
  statusText?: string | null;
  joinedAt?: ISODateString | null;
}>;
