-- Chat query indexes
-- Adds targeted indexes for high-frequency desktop chat reads without changing table shape.

create index if not exists idx_messages_channel_created_id_desc
  on public.messages(channel_id, created_at desc, id desc);

create index if not exists idx_messages_community_created_at
  on public.messages(community_id, created_at desc);

create index if not exists idx_messages_channel_author_created_at
  on public.messages(channel_id, author_id, created_at desc);

create index if not exists idx_channels_community_category_position
  on public.channels(community_id, category_id, position);

create index if not exists idx_community_members_community_role_joined
  on public.community_members(community_id, role_id, joined_at);

create index if not exists idx_read_states_user_updated_at
  on public.read_states(user_id, updated_at desc);

create index if not exists idx_attachments_message_created_at
  on public.attachments(message_id, created_at);