import type { Community, CommunityId, UserId } from "../types/community";
import type { CommunityOnboardingItem, CommunityOnboardingItemId, CommunityOnboardingState } from "../types/communityOnboarding";

const STORAGE_KEY = "picom.communityOnboarding.v1";

const defaultItems: CommunityOnboardingItem[] = [
  {
    id: "set_icon",
    title: "Set community icon",
    description: "Give members a recognizable space in the server rail.",
    actionLabel: "Mark done",
  },
  {
    id: "add_description",
    title: "Add description",
    description: "Explain what this community is for in one short line.",
    actionLabel: "Mark done",
  },
  {
    id: "create_first_channel",
    title: "Create first channel",
    description: "Add a focused place for the first conversation.",
    actionLabel: "Mark done",
  },
  {
    id: "invite_people",
    title: "Invite people",
    description: "Bring in the first members when the space is ready.",
    actionLabel: "Mark done",
  },
  {
    id: "set_rules",
    title: "Set rules",
    description: "Prepare a simple welcome agreement for new members.",
    actionLabel: "Mark done",
  },
  {
    id: "configure_roles",
    title: "Configure roles",
    description: "Review owner, admin, moderator, and member permissions.",
    actionLabel: "Mark done",
  },
  {
    id: "send_first_message",
    title: "Send first message",
    description: "Start the room with a warm opening message.",
    actionLabel: "Mark done",
  },
  {
    id: "configure_notifications",
    title: "Configure notifications",
    description: "Set default notification behavior placeholder.",
    actionLabel: "Mark done",
  },
];

type PersistedOnboarding = Record<string, CommunityOnboardingState>;

function getStateKey(communityId: CommunityId, userId: UserId) {
  return `${communityId}:${userId}`;
}

function emptyState(communityId: CommunityId, userId: UserId): CommunityOnboardingState {
  return {
    communityId,
    userId,
    dismissed: false,
    completed: {},
    updatedAt: new Date().toISOString(),
  };
}

function readStore(): PersistedOnboarding {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return {};
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as PersistedOnboarding;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: PersistedOnboarding) {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Local persistence is helpful, not required for core chat.
  }
}

function saveState(state: CommunityOnboardingState) {
  const store = readStore();
  const nextState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  store[getStateKey(state.communityId, state.userId)] = nextState;
  writeStore(store);
  return nextState;
}

function getInferredCompletedItems(community: Community): Partial<Record<CommunityOnboardingItemId, boolean>> {
  const channelCount = community.categories.reduce((total, category) => total + category.channels.length, 0);

  return {
    set_icon: Boolean(community.icon),
    create_first_channel: channelCount > 0,
    send_first_message: community.messages.length > 0,
  };
}

export const communityOnboardingService = {
  getItems(): CommunityOnboardingItem[] {
    return defaultItems;
  },

  getState(communityId: CommunityId, userId: UserId): CommunityOnboardingState {
    const store = readStore();
    return store[getStateKey(communityId, userId)] ?? emptyState(communityId, userId);
  },

  getCompletedItems(community: Community, userId: UserId): Partial<Record<CommunityOnboardingItemId, boolean>> {
    const state = this.getState(community.id, userId);
    return {
      ...getInferredCompletedItems(community),
      ...state.completed,
    };
  },

  setItemCompleted(communityId: CommunityId, userId: UserId, itemId: CommunityOnboardingItemId, completed: boolean) {
    const state = this.getState(communityId, userId);
    return saveState({
      ...state,
      completed: {
        ...state.completed,
        [itemId]: completed,
      },
    });
  },

  dismiss(communityId: CommunityId, userId: UserId) {
    const state = this.getState(communityId, userId);
    return saveState({
      ...state,
      dismissed: true,
    });
  },

  reset(communityId: CommunityId, userId: UserId) {
    const store = readStore();
    delete store[getStateKey(communityId, userId)];
    writeStore(store);
  },
};
