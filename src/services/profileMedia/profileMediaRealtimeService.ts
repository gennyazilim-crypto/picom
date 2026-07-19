import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { profileMediaInvalidationService } from "./profileMediaInvalidationService";
import { profileMediaResolver } from "./profileMediaResolver";

let channel: RealtimeChannel | null = null;
let started = false;
let authCleanup: (() => void) | null = null;

function stopChannel(): void {
  const client = getSupabaseClient();
  if (client && channel) void client.removeChannel(channel);
  channel = null;
}

function startChannel(): void {
  const client = getSupabaseClient();
  if (!client || channel) return;
  channel = client
    .channel("profile-media:centralized:v1")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
      const row = payload.new as Record<string, unknown>;
      const userId = typeof row.id === "string" ? row.id : null;
      if (!userId) return;
      profileMediaInvalidationService.invalidate(userId);
      void profileMediaResolver.resolve(userId, { force: true });
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") void profileMediaResolver.refreshTracked();
    });
}

export const profileMediaRealtimeService = {
  async start(): Promise<void> {
    if (started) return;
    started = true;
    const client = getSupabaseClient();
    if (!client) return;
    const { data } = await client.auth.getSession();
    if (data.session) startChannel();
    const subscription = client.auth.onAuthStateChange((event, session) => {
      if (session && event !== "SIGNED_OUT") startChannel();
      if (event === "SIGNED_OUT") stopChannel();
    });
    authCleanup = () => subscription.data.subscription.unsubscribe();
  },
  stop(): void {
    stopChannel();
    authCleanup?.();
    authCleanup = null;
    started = false;
  },
};
