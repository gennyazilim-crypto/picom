type UnreadDividerProps = {
  label?: string;
};

export function UnreadDivider({ label = "Unread messages" }: UnreadDividerProps) {
  return (
    <div className="unread-divider" role="separator" aria-label={label}>
      <span />
      {label}
      <span />
    </div>
  );
}
