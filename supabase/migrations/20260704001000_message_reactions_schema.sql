-- Message reactions table schema hardening
-- Keeps reaction rows compact and efficient for the MVP chat UI.

alter table public.message_reactions
  add constraint message_reactions_emoji_length check (char_length(emoji) between 1 and 64),
  add constraint message_reactions_emoji_no_control_chars check (emoji !~ '[[:cntrl:]]');
create index if not exists idx_reactions_message_emoji
  on public.message_reactions(message_id, emoji);
create index if not exists idx_reactions_user_created_at
  on public.message_reactions(user_id, created_at desc);
