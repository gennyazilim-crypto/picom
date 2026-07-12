import type { MeetingReactionKind } from "../../types/meeting";

export type MeetingReactionOption = Readonly<{
  kind: MeetingReactionKind;
  emoji: string;
  label: string;
}>;

export const MEETING_REACTION_OPTIONS: readonly MeetingReactionOption[] = [
  { kind: "thumbs_up", emoji: "👍", label: "Thumbs up" },
  { kind: "heart", emoji: "❤️", label: "Heart" },
  { kind: "celebrate", emoji: "🎉", label: "Celebrate" },
  { kind: "laugh", emoji: "😄", label: "Laugh" },
  { kind: "surprised", emoji: "😮", label: "Surprised" },
  { kind: "clap", emoji: "👏", label: "Clap" },
];

const reactionsByKind = new Map(MEETING_REACTION_OPTIONS.map((reaction) => [reaction.kind, reaction]));

export function getMeetingReactionOption(kind: MeetingReactionKind): MeetingReactionOption {
  return reactionsByKind.get(kind) ?? MEETING_REACTION_OPTIONS[0];
}
