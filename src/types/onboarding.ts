import type { ThemeMode } from "../services/settingsService";

export type OnboardingStepId = "welcome" | "profile" | "start" | "follow" | "theme" | "finish";
export type OnboardingStartChoice = "createCommunity" | "joinInvite" | "mentionFeed" | "demoCommunity";

export type OnboardingProfileBasics = Readonly<{
  displayName: string;
  statusText: string;
}>;

export type OnboardingCompletion = Readonly<{
  profile: OnboardingProfileBasics;
  startChoice: OnboardingStartChoice;
  inviteCode?: string;
  followedUserIds: string[];
  theme: ThemeMode;
}>;

export type OnboardingRecord = Readonly<{
  completed: boolean;
  completedAt: string | null;
  followedUserIds: string[];
  provider: "mock" | "supabase";
}>;
