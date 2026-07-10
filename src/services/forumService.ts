import type { CreateForumPostInput, ForumPost } from "../types/forum";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
const STORAGE_KEY = "picom.forumPosts.v1";
const MAX_RESULTS = 100;

function read(): ForumPost[] { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); return Array.isArray(value) ? value as ForumPost[] : []; } catch { return []; } }
function write(posts: ForumPost[]): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); } catch { /* restricted fallback */ } }
function seed(communityId: string, channelId: string, authorId: string): ForumPost[] {
  const rows = [
    ["Share your latest workspace update", "Show what the team shipped this week.", ["Showcase"]],
    ["How should we structure design reviews?", "Collect a focused review checklist for desktop work.", ["Design", "Feedback"]],
    ["Desktop setup checklist", "Document the stable Windows, Linux, and macOS setup.", ["Help", "Resolved"]],
  ] as const;
  return rows.map(([title, body, tags], index) => ({ id: `${channelId}-post-${index + 1}`, communityId, channelId, parentMessageId: `${channelId}-forum-root-${index + 1}`, threadId: `${channelId}-forum-thread-${index + 1}`, title, body, authorId, tags: [...tags], replyCount: [8, 13, 5][index], lastActivityAt: `2026-07-0${8 + index}T12:00:00.000Z`, createdAt: `2026-07-0${7 + index}T12:00:00.000Z`, status: index === 2 ? "resolved" : "open" }));
}
function normalizeTags(tags: string[]): string[] { return [...new Set(tags.map((tag) => tag.trim().slice(0, 30)).filter(Boolean))].slice(0, 5); }
function mapRow(row: { id: string; community_id: string; channel_id: string; parent_message_id: string; thread_id: string; title: string; body: string; author_id: string; tags: string[]; status: string; created_at: string; updated_at: string }, replyCount = 0, lastReplyAt?: string): ForumPost {
  return { id: row.id, communityId: row.community_id, channelId: row.channel_id, parentMessageId: row.parent_message_id, threadId: row.thread_id, title: row.title, body: row.body, authorId: row.author_id, tags: row.tags, replyCount, lastActivityAt: lastReplyAt ?? row.updated_at, createdAt: row.created_at, status: row.status === "resolved" ? "resolved" : "open" };
}

export const forumService = {
  async listPosts(input: { communityId: string; channelId: string; query?: string }): Promise<Result<ForumPost[]>> {
    const query = input.query?.trim().toLowerCase() ?? "";
    if (dataSourceService.getStatus().isMock) { let posts = read().filter((post) => post.channelId === input.channelId); if (!posts.length) { posts = seed(input.communityId, input.channelId, "mock-current-user"); write([...read(), ...posts]); } return { ok: true, data: posts.filter((post) => !query || post.title.toLowerCase().includes(query) || post.body.toLowerCase().includes(query)).slice(0, MAX_RESULTS) }; }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Forum posts are unavailable." };
    let request = client.from("forum_posts").select("id,community_id,channel_id,parent_message_id,thread_id,title,body,author_id,tags,status,created_at,updated_at").eq("channel_id", input.channelId).order("updated_at", { ascending: false }).limit(MAX_RESULTS);
    if (query) { const safeQuery = query.replace(/[%_,()]/g, ""); request = request.or(`title.ilike.%${safeQuery}%,body.ilike.%${safeQuery}%`); }
    const result = await request; if (result.error) return { ok: false, message: "Could not load forum posts." };
    const threadIds = (result.data ?? []).map((post) => post.thread_id);
    const replies = threadIds.length ? await client.from("messages").select("thread_id,created_at").in("thread_id", threadIds).is("deleted_at", null).order("created_at") : { data: [], error: null };
    const summaries = new Map<string, { count: number; last?: string }>();
    for (const reply of replies.data ?? []) { if (!reply.thread_id) continue; const current = summaries.get(reply.thread_id) ?? { count: 0 }; summaries.set(reply.thread_id, { count: current.count + 1, last: reply.created_at }); }
    return { ok: true, data: (result.data ?? []).map((post) => { const summary = summaries.get(post.thread_id); return mapRow(post, summary?.count ?? 0, summary?.last); }) };
  },
  async createPost(input: CreateForumPostInput, canCreate: boolean): Promise<Result<ForumPost>> {
    if (!canCreate) return { ok: false, message: "You do not have permission to create forum posts." };
    const title = input.title.trim().slice(0, 180); const body = input.body.trim().slice(0, 4000); const tags = normalizeTags(input.tags);
    if (!title || !body) return { ok: false, message: "Forum title and body are required." };
    if (dataSourceService.getStatus().isMock) { const now = new Date().toISOString(); const post: ForumPost = { id: `forum-post-${crypto.randomUUID()}`, communityId: input.communityId, channelId: input.channelId, parentMessageId: `forum-root-${crypto.randomUUID()}`, threadId: `forum-thread-${crypto.randomUUID()}`, title, body, authorId: input.authorId, tags, replyCount: 0, lastActivityAt: now, createdAt: now, status: "open" }; write([post, ...read()]); return { ok: true, data: post }; }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Forum post creation is unavailable." }; const auth = await client.auth.getUser(); if (auth.data.user?.id !== input.authorId) return { ok: false, message: "Sign in again before creating a post." };
    const result = await client.rpc("create_forum_post", { target_community_id: input.communityId, target_channel_id: input.channelId, post_title: title, post_body: body, post_tags: tags });
    if (result.error || !result.data || typeof result.data !== "object") return { ok: false, message: "Picom could not create the forum post." };
    return { ok: true, data: mapRow(result.data as unknown as { id: string; community_id: string; channel_id: string; parent_message_id: string; thread_id: string; title: string; body: string; author_id: string; tags: string[]; status: string; created_at: string; updated_at: string }) };
  },
};
