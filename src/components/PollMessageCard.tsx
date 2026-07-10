import { useEffect, useState } from "react";
import type { PollData } from "../types/polls";
import { dateTimeService } from "../services/dateTimeService";
import { pollService } from "../services/pollService";
import { AppIcon } from "./AppIcon";

export function PollMessageCard({ initialPoll, currentUserId, canClose = false, onNotice }: { initialPoll: PollData; currentUserId: string; canClose?: boolean; onNotice?: (message: string, tone?: "info" | "error" | "success") => void }) {
  const [poll, setPoll] = useState(initialPoll);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setPoll(initialPoll); }, [initialPoll]);
  useEffect(() => pollService.subscribe(poll.id, setPoll), [poll.id]);
  const total = poll.options.reduce((sum, option) => sum + option.voteCount, 0);
  const closed = Boolean(poll.closedAt || (poll.closesAt && Date.parse(poll.closesAt) <= Date.now()));
  const vote = async (optionId: string) => { setBusy(optionId); const result = await pollService.toggleVote(poll, optionId, currentUserId); if (result.ok) setPoll(result.data); else onNotice?.(result.message, "error"); setBusy(null); };
  const close = async () => { setBusy("close"); const result = await pollService.close(poll); if (result.ok) { setPoll(result.data); onNotice?.("Poll closed.", "success"); } else onNotice?.(result.message, "error"); setBusy(null); };
  return <section className="poll-message-card"><header><span><AppIcon name="inbox" size="sm" /></span><div><small>Poll</small><strong>{poll.question}</strong></div>{canClose && !closed ? <button type="button" className="secondary-action" disabled={busy !== null} onClick={() => void close()}>Close poll</button> : null}</header><div className="poll-options">{poll.options.map((option) => { const percentage = total ? Math.round(option.voteCount / total * 100) : 0; return <button key={option.id} type="button" className={option.votedByCurrentUser ? "selected" : ""} disabled={closed || busy !== null} onClick={() => void vote(option.id)}><span className="poll-option-progress" style={{ width: `${percentage}%` }} /><span className="poll-option-label">{option.text}</span><strong>{option.voteCount}</strong><small>{percentage}%</small></button>; })}</div><footer><span>{total} vote{total === 1 ? "" : "s"}{poll.allowMultiple ? " · Multiple choice" : ""}</span><span>{closed ? "Closed" : poll.closesAt ? `Closes ${dateTimeService.formatFullTimestamp(poll.closesAt)}` : "No close time"}</span></footer></section>;
}
