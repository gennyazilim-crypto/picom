import type { Database } from "../services/supabase/database.types";

const createdAt = "2026-07-12T12:00:00.000Z";

export const feedRollupSchemaFixture = {
  item: {
    id: "10000000-0000-4000-8000-000000000001",
    source_type: "text_message",
    source_id: "20000000-0000-4000-8000-000000000001",
    parent_source_id: null,
    community_id: "30000000-0000-4000-8000-000000000001",
    channel_id: "40000000-0000-4000-8000-000000000001",
    author_id: "50000000-0000-4000-8000-000000000001",
    content_kind: "text_image",
    base_score: 3,
    moderation_state: "visible",
    deleted_at: null,
    source_created_at: createdAt,
    source_updated_at: createdAt,
    last_engagement_at: createdAt,
    score_version: 1,
    created_at: createdAt,
    updated_at: createdAt,
  },
  rollup: {
    feed_item_id: "10000000-0000-4000-8000-000000000001",
    unique_external_reactors: 1,
    unique_external_commenters: 0,
    additional_reply_count: 0,
    unique_external_savers: 0,
    unique_external_viewers: 0,
    external_supporter_count: 1,
    reaction_score: 1,
    comment_score: 0,
    save_score: 0,
    view_score: 0,
    raw_score: 4,
    score_version: 1,
    updated_at: createdAt,
  },
  userState: {
    user_id: "60000000-0000-4000-8000-000000000001",
    feed_item_id: "10000000-0000-4000-8000-000000000001",
  },
  impression: {
    user_id: "60000000-0000-4000-8000-000000000001",
    feed_item_id: "10000000-0000-4000-8000-000000000001",
    session_id: "70000000-0000-4000-8000-000000000001",
    position: 0,
    feed_mode: "feed",
    as_of: createdAt,
  },
} satisfies Readonly<{
  item: Database["public"]["Tables"]["feed_items"]["Row"];
  rollup: Database["public"]["Tables"]["feed_engagement_rollups"]["Row"];
  userState: Database["public"]["Tables"]["feed_user_states"]["Insert"];
  impression: Database["public"]["Tables"]["feed_impressions"]["Insert"];
}>;

