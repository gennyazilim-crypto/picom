import type { ISODateString, UUIDString } from "../types/common";
import type { PermissionMapDTO } from "../permissions";

export type RoleDTO = Readonly<{
  id: UUIDString;
  communityId: UUIDString;
  name: string;
  color: string;
  level: number;
  permissions: PermissionMapDTO;
  createdAt?: ISODateString | null;
  updatedAt?: ISODateString | null;
}>;
