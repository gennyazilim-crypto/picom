import type { ThemeMode } from "../services/settingsService";

export type OnboardingStepId = "profile" | "theme" | "community" | "follow" | "finish";
export type OnboardingStartChoice = "createCommunity" | "joinInvite" | "mentionFeed";

export type OnboardingProfileBasics = Readonly<{
  displayName: string;
  username: string;
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
  profile: OnboardingProfileBasics | null;
  provider: "mock" | "supabase";
}>;

