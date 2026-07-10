import { mockFollowedUserStories } from "../data/mockStories";
import type { FollowedUserStory, StoryType } from "../types/stories";
import { dataSourceService } from "./dataSourceService";
import type { Database } from "./supabase/database.types";
import { getSupabaseClient } from "./supabase/supabaseClient";

type StoryRow = Database["public"]["Views"]["followed_user_stories_view"]["Row"];
type StoryResult = Readonly<{ ok: true; data: { items: FollowedUserStory[]; nextCursor: string | null; hasMore: boolean } }> | Readonly<{ ok: false; error: { code: string; message: string } }>;

const allowedTypes = new Set<StoryType>(["status", "mention_highlight", "media", "voice", "event", "community_update"]);
const gradientByType: Record<StoryType, string> = {
  status: "story-bg-ocean",
  mention_highlight: "story-bg-warm",
  media: "story-bg-mountain",
  voice: "story-bg-voice",
  event: "story-bg-event",
  community_update: "story-bg-teal",
};

function encodeCursor(createdAt: string, storyId: string): string {
  return encodeURIComponent(JSON.stringify({ createdAt, storyId }));
}

function decodeCursor(value?: string | null): { createdAt: string; storyId: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as { createdAt?: unknown; storyId?: unknown };
    return typeof parsed.createdAt === "string" && typeof parsed.storyId === "string" ? { createdAt: parsed.createdAt, storyId: parsed.storyId } : null;
  } catch { return null; }
}

function timeLabel(createdAt: string): string {
  const ageMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60_000));
  if (ageMinutes < 60) return `${Math.max(1, ageMinutes)} min`;
  if (ageMinutes < 24 * 60) return `${Math.floor(ageMinutes / 60)} h`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(createdAt));
}

function mapRow(row: StoryRow): FollowedUserStory {
  const type = allowedTypes.has(row.story_type as StoryType) ? row.story_type as StoryType : "community_update";
  return {
    id: row.story_id,
    authorId: row.author_id,
    communityId: row.community_id ?? undefined,
    channelId: row.channel_id ?? undefined,
    messageId: row.message_id ?? undefined,
    type,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    body: row.body ?? undefined,
    imageUrl: row.image_url ?? undefined,
    gradient: row.gradient_variant ?? gradientByType[type],
    timeLabel: timeLabel(row.created_at),
    createdAt: row.created_at,
    status: "unseen",
    durationSeconds: row.duration_seconds,
    mentionedUserIds: row.mentioned_user_ids,
  };
}

async function listPage(input: Readonly<{ cursor?: string | null; limit?: number }> = {}): Promise<StoryResult> {
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 40);
  const cursor = decodeCursor(input.cursor);
  if (dataSourceService.getStatus().isMock) {
    const ordered = [...mockFollowedUserStories].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt) || right.id.localeCompare(left.id));
    const start = cursor ? Math.max(0, ordered.findIndex((story) => story.createdAt === cursor.createdAt && story.id === cursor.storyId) + 1) : 0;
    const items = ordered.slice(start, start + limit);
    const hasMore = start + limit < ordered.length;
    const last = items[items.length - 1];
    return { ok: true, data: { items, hasMore, nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null } };
  }

  const client = getSupabaseClient();
  if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Following Stories are unavailable until Picom reconnects." } };
  const { data, error } = await client.rpc("list_followed_user_stories", {
    cursor_created_at: cursor?.createdAt ?? null,
    cursor_story_id: cursor?.storyId ?? null,
    result_limit: limit + 1,
  });
  if (error) return { ok: false, error: { code: "STORIES_LOAD_FAILED", message: "Picom could not load Following Stories." } };
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const items = pageRows.map(mapRow);
  const last = pageRows[pageRows.length - 1];
  return { ok: true, data: { items, hasMore, nextCursor: hasMore && last ? encodeCursor(last.created_at, last.story_id) : null } };
}

export const storyService = { listPage };
