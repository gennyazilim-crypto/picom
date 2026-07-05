import type { ISODateString, UserStatus, UUIDString } from "../types/common";

export type UserDTO = Readonly<{
  id: UUIDString;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  status?: UserStatus;
  statusText?: string | null;
  bio?: string | null;
  emailVerifiedAt?: ISODateString | null;
  createdAt?: ISODateString | null;
}>;
