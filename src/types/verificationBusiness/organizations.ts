import type { IsoTimestamp, Uuid } from "./shared";

export type OrganizationRole = "organization_owner" | "business_admin" | "billing_admin" | "campaign_manager" | "brand_manager" | "content_manager" | "analyst" | "support_contact";
export type OrganizationStatus = "draft" | "active" | "suspended" | "archived";

export type Organization = Readonly<{
  id: Uuid;
  displayName: string;
  status: OrganizationStatus;
  createdAt: IsoTimestamp;
}>;

export type OrganizationMember = Readonly<{
  organizationId: Uuid;
  userId: Uuid;
  role: OrganizationRole;
  createdAt: IsoTimestamp;
}>;
