import type { CommunityId, UserId } from "./community";

export type CommunityOnboardingItemId =
  | "set_icon"
  | "add_description"
  | "create_first_channel"
  | "invite_people"
  | "set_rules"
  | "configure_roles"
  | "send_first_message"
  | "configure_notifications";

export interface CommunityOnboardingItem {
  id: CommunityOnboardingItemId;
  title: string;
  description: string;
  actionLabel: string;
}

export interface CommunityOnboardingState {
  communityId: CommunityId;
  userId: UserId;
  dismissed: boolean;
  completed: Partial<Record<CommunityOnboardingItemId, boolean>>;
  updatedAt: string;
}
