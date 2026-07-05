import { appConfig } from "../../config/appConfig";
import { featureFlagService } from "../featureFlagService";
import { realtimeChannelNames } from "./realtimeService";

export type RealtimeScalingMode = "supabase_managed" | "disabled" | "external_pubsub_placeholder";
export type RealtimeFanoutStrategy = "supabase_realtime" | "none" | "pubsub_placeholder";
export type RealtimePresenceStrategy = "supabase_presence" | "none" | "external_presence_placeholder";

export type RealtimeScalingSnapshot = Readonly<{
  enabled: boolean;
  mode: RealtimeScalingMode;
  fanoutStrategy: RealtimeFanoutStrategy;
  presenceStrategy: RealtimePresenceStrategy;
  requiresRedis: boolean;
  roomPattern: "community_channel";
  messageRoomExample: string;
  presenceRoomExample: string;
  typingRoomExample: string;
  notes: readonly string[];
}>;

function parseRealtimeScalingMode(value: string | undefined): RealtimeScalingMode {
  if (value === "disabled" || value === "external_pubsub_placeholder" || value === "supabase_managed") {
    return value;
  }

  return "supabase_managed";
}

function getMode(): RealtimeScalingMode {
  return parseRealtimeScalingMode(appConfig.realtimeScalingMode);
}

function getFanoutStrategy(mode: RealtimeScalingMode): RealtimeFanoutStrategy {
  if (mode === "disabled") return "none";
  if (mode === "external_pubsub_placeholder") return "pubsub_placeholder";
  return "supabase_realtime";
}

function getPresenceStrategy(mode: RealtimeScalingMode): RealtimePresenceStrategy {
  if (mode === "disabled") return "none";
  if (mode === "external_pubsub_placeholder") return "external_presence_placeholder";
  return "supabase_presence";
}

export const realtimeScalingService = {
  getMode,

  isRealtimeEnabled(): boolean {
    return featureFlagService.isEnabled("enableRealtime") && getMode() !== "disabled";
  },

  getSnapshot(): RealtimeScalingSnapshot {
    const mode = getMode();
    const enabled = this.isRealtimeEnabled();

    return Object.freeze({
      enabled,
      mode,
      fanoutStrategy: getFanoutStrategy(mode),
      presenceStrategy: getPresenceStrategy(mode),
      requiresRedis: mode === "external_pubsub_placeholder",
      roomPattern: "community_channel",
      messageRoomExample: realtimeChannelNames.messages("community_id", "channel_id"),
      presenceRoomExample: realtimeChannelNames.presence("community_id"),
      typingRoomExample: realtimeChannelNames.typing("community_id", "channel_id"),
      notes: Object.freeze([
        "Supabase Realtime remains the MVP scaling path.",
        "RLS and channel visibility remain the security boundary.",
        "External pub/sub is documented as a placeholder only.",
      ]),
    });
  },

  getRoomMetadata(communityId: string, channelId: string) {
    return Object.freeze({
      communityId,
      channelId,
      messageRoom: realtimeChannelNames.messages(communityId, channelId),
      typingRoom: realtimeChannelNames.typing(communityId, channelId),
      presenceRoom: realtimeChannelNames.presence(communityId),
    });
  },
};
