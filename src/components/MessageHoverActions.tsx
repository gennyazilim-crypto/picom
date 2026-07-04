import { AppIcon } from "./AppIcon";

type MessageHoverActionsProps = {
  onReply?: () => void;
  onReact?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMore?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function MessageHoverActions({ onReply, onReact, onEdit, onDelete, onMore, canEdit = false, canDelete = false }: MessageHoverActionsProps) {
  return (
    <div className="message-hover-actions" aria-label="Message actions">
      <button aria-label="Reply" title="Reply" onClick={onReply}>
        <AppIcon name="reply" size="sm" />
      </button>
      <button aria-label="React" title="React" onClick={onReact}>
        <AppIcon name="smile" size="sm" />
      </button>
      {canEdit ? (
        <button aria-label="Edit" title="Edit" onClick={onEdit}>
          <AppIcon name="edit" size="sm" />
        </button>
      ) : null}
      {canDelete ? (
        <button aria-label="Delete" title="Delete" onClick={onDelete}>
          <AppIcon name="trash" size="sm" />
        </button>
      ) : null}
      <button aria-label="More" title="More" onClick={onMore}>
        <AppIcon name="more" size="sm" />
      </button>
    </div>
  );
}
