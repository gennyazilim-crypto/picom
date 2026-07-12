export type MeetingParticipantLocalControls = Readonly<{
  volume: number;
  locallyMuted: boolean;
  selfViewVisible: boolean;
}>;

export type MeetingParticipantModerationAction =
  | "mute"
  | "remove"
  | "deny_screen_share"
  | "promote"
  | "demote";
