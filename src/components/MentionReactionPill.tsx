import type { Reaction } from "../types/community";

type MentionReactionPillProps = {
  reactions?: Reaction[];
};

export function MentionReactionPill({ reactions }: MentionReactionPillProps) {
  if (!reactions?.length) {
    return null;
  }

  const total = reactions.reduce((sum, reaction) => sum + reaction.count, 0);
  const label = reactions.slice(0, 2).map((reaction) => reaction.emoji).join(" + ");

  return (
    <span className="mention-reaction-pill">
      <strong>{label}</strong>
      <span>{total}</span>
    </span>
  );
}
