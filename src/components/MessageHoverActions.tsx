import { AppIcon } from "./AppIcon";

type MessageHoverActionsProps = {
  onReply?: () => void;
  onReact?: () => void;
  onMore?: () => void;
};

export function MessageHoverActions({ onReply, onReact, onMore }: MessageHoverActionsProps) {
  return (
    <div className="message-hover-actions" aria-label="Message actions">
      <button aria-label="Reply" title="Reply" onClick={onReply}>
        <AppIcon name="reply" size="sm" />
      </button>
      <button aria-label="React" title="React" onClick={onReact}>
        <AppIcon name="smile" size="sm" />
      </button>
      <button aria-label="More" title="More" onClick={onMore}>
        <AppIcon name="more" size="sm" />
      </button>
    </div>
  );
}
