// Committed public-schema type snapshot. Regenerate atomically with `npm run supabase:types`
// after applying every migration to local or reviewed staging Supabase.
// Do not hand-add secrets or server-only environment values here.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          status: string;
          status_text: string;
          bio: string | null;
          accent_color: string | null;
          onboarding_completed: boolean;
          onboarding_completed_at: string | null;
          is_bot: boolean;
          deletion_requested_at: string | null;
          accepted_terms_version: string | null;
          terms_accepted_at: string | null;
          accepted_privacy_version: string | null;
          privacy_accepted_at: string | null;
          dm_privacy: "everyone" | "friends" | "no_one";
          friend_request_privacy: "everyone" | "community_members" | "friends_of_friends" | "nobody";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "username" | "display_name">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      communities: {
        Row: {
          id: string;
          kind: Database["public"]["Enums"]["community_kind"];
          owner_id: string;
          name: string;
          description: string | null;
          icon_url: string | null;
          banner_url: string | null;
          accent_color: string;
          visibility: "public" | "private";
          public_read_enabled: boolean;
          default_notification_level: "all" | "mentions" | "none";
          type_settings: Json;
          rules_enabled: boolean;
          rules_version: string;
          discovery_listed: boolean;
          discovery_join_policy: "open" | "request";
          category: "development" | "design" | "gaming" | "music" | "study" | "work" | null;
          discovery_content_flags: string[];
          creation_request_id: string | null;
          creation_template_id: string | null;
          archived_at: string | null;
          archived_by: string | null;
          archive_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["communities"]["Row"]> & Pick<Database["public"]["Tables"]["communities"]["Row"], "owner_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["communities"]["Row"]>;
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          community_id: string;
          name: string;
          color: string;
          level: number;
          permissions: Json;
          system_key: "owner" | "admin" | "moderator" | "member" | null;
          is_default: boolean;
          permissions_version: number;
          icon: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["roles"]["Row"]> & Pick<Database["public"]["Tables"]["roles"]["Row"], "community_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["roles"]["Row"]>;
        Relationships: [];
      };
      community_members: {
        Row: {
          id: string;
          community_id: string;
          user_id: string;
          role_id: string | null;
          joined_at: string;
          rules_accepted_at: string | null;
          rules_version_accepted: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["community_members"]["Row"]> & Pick<Database["public"]["Tables"]["community_members"]["Row"], "community_id" | "user_id">;
        Update: Partial<Database["public"]["Tables"]["community_members"]["Row"]>;
        Relationships: [];
      };
      community_rules: {
        Row: { id: string; community_id: string; title: string; body: string; position: number; required: boolean; published: boolean; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["community_rules"]["Row"]> & Pick<Database["public"]["Tables"]["community_rules"]["Row"], "community_id" | "title" | "body">;
        Update: Partial<Database["public"]["Tables"]["community_rules"]["Row"]>;
        Relationships: [];
      };
      community_member_roles: {
        Row: { id: string; community_id: string; member_id: string; role_id: string; is_primary: boolean; assigned_by: string | null; assigned_at: string };
        Insert: Partial<Database["public"]["Tables"]["community_member_roles"]["Row"]> & Pick<Database["public"]["Tables"]["community_member_roles"]["Row"], "community_id" | "member_id" | "role_id">;
        Update: Partial<Database["public"]["Tables"]["community_member_roles"]["Row"]>;
        Relationships: [];
      };
      community_member_role_audit: {
        Row: { id: string; community_id: string; member_id: string; target_user_id: string; actor_id: string; old_role_ids: string[]; new_role_ids: string[]; reason: string; created_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      community_permission_definitions: {
        Row: { permission_key: string; category: string; allowed_kinds: string[]; delegable: boolean; owner_reserved: boolean; description: string; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["community_permission_definitions"]["Row"]> & Pick<Database["public"]["Tables"]["community_permission_definitions"]["Row"], "permission_key" | "category" | "description">;
        Update: Partial<Database["public"]["Tables"]["community_permission_definitions"]["Row"]>;
        Relationships: [];
      };
      community_role_permissions: {
        Row: { id: string; community_id: string; role_id: string; permission_key: string; allowed: boolean; created_by: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["community_role_permissions"]["Row"]> & Pick<Database["public"]["Tables"]["community_role_permissions"]["Row"], "community_id" | "role_id" | "permission_key" | "allowed">;
        Update: Partial<Database["public"]["Tables"]["community_role_permissions"]["Row"]>;
        Relationships: [];
      };
      community_permission_overrides: {
        Row: { id: string; community_id: string; role_id: string; scope_type: "category" | "channel" | "radio_program" | "podcast_series"; scope_id: string; permission_key: string; effect: "allow" | "deny"; created_by: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["community_permission_overrides"]["Row"]> & Pick<Database["public"]["Tables"]["community_permission_overrides"]["Row"], "community_id" | "role_id" | "scope_type" | "scope_id" | "permission_key" | "effect">;
        Update: Partial<Database["public"]["Tables"]["community_permission_overrides"]["Row"]>;
        Relationships: [];
      };
      profile_details: {
        Row: { user_id: string; cover_url: string | null; preferred_language: string | null; tags: string[]; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["profile_details"]["Row"]> & Pick<Database["public"]["Tables"]["profile_details"]["Row"], "user_id">;
        Update: Partial<Database["public"]["Tables"]["profile_details"]["Row"]>;
        Relationships: [];
      };
      channel_categories: {
        Row: {
          id: string;
          community_id: string;
          name: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["channel_categories"]["Row"]> & Pick<Database["public"]["Tables"]["channel_categories"]["Row"], "community_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["channel_categories"]["Row"]>;
        Relationships: [];
      };
      channels: {
        Row: {
          id: string;
          community_id: string;
          category_id: string | null;
          name: string;
          type: "text" | "voice" | "forum" | "announcement";
          topic: string | null;
          is_private: boolean;
          public_read_enabled: boolean;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["channels"]["Row"]> & Pick<Database["public"]["Tables"]["channels"]["Row"], "community_id" | "name">;
        Update: Partial<Database["public"]["Tables"]["channels"]["Row"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          community_id: string;
          channel_id: string;
          author_id: string;
          body: string;
          client_message_id: string | null;
          sequence: number | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
          reply_to_message_id: string | null;
          thread_id: string | null;
          webhook_id: string | null;
          webhook_name: string | null;
          search_vector: unknown;
        };
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & Pick<Database["public"]["Tables"]["messages"]["Row"], "community_id" | "channel_id" | "author_id">;
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          message_id: string | null;
          uploader_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          attachment_type: "image";
          width: number | null;
          height: number | null;
          public_url: string | null;
          thumbnail_url: string | null;
          scan_status: "pending" | "clean" | "suspicious" | "failed" | "skipped_development";
          status: "pending" | "attached" | "failed";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["attachments"]["Row"]> & Pick<Database["public"]["Tables"]["attachments"]["Row"], "uploader_id" | "storage_path" | "file_name" | "mime_type" | "size_bytes">;
        Update: Partial<Database["public"]["Tables"]["attachments"]["Row"]>;
        Relationships: [];
      };
      message_reactions: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["message_reactions"]["Row"]> & Pick<Database["public"]["Tables"]["message_reactions"]["Row"], "message_id" | "user_id" | "emoji">;
        Update: Partial<Database["public"]["Tables"]["message_reactions"]["Row"]>;
        Relationships: [];
      };
      community_events: {
        Row: { id:string;community_id:string;channel_id:string|null;title:string;description:string;starts_at:string;ends_at:string|null;event_type:"meeting"|"voice"|"release"|"review"|"social";created_by:string;cancelled_at:string|null;created_at:string;updated_at:string };
        Insert: Partial<Database["public"]["Tables"]["community_events"]["Row"]> & Pick<Database["public"]["Tables"]["community_events"]["Row"],"community_id"|"title"|"starts_at"|"created_by">;
        Update: Partial<Database["public"]["Tables"]["community_events"]["Row"]>;Relationships:[];
      };
      meeting_rooms: {
        Row: { id:string;community_id:string;channel_id:string|null;event_id:string|null;linked_chat_channel_id:string|null;source_kind:"community_channel"|"scheduled_event"|"ad_hoc";mode:"voice"|"meeting"|"stage";title:string;description:string;status:"scheduled"|"open"|"live"|"ended"|"cancelled"|"locked";join_policy:"open"|"members"|"invite_only"|"approval_required";default_role:"host"|"cohost"|"speaker"|"participant"|"viewer"|"guest";host_user_id:string;cohost_user_ids:string[];created_by:string;approved_by_user_id:string|null;capabilities:Json;metadata:Json;reminder_policy:Json;waiting_room_enabled:boolean;max_participants:number;audience_mode:boolean;moderation_policy:Json;position:number;archived_at:string|null;archived_by_user_id:string|null;scheduled_for:string|null;scheduled_end_at:string|null;locked_at:string|null;locked_by_user_id:string|null;ended_at:string|null;ended_by_user_id:string|null;created_at:string;updated_at:string };
        Insert: Partial<Database["public"]["Tables"]["meeting_rooms"]["Row"]> & Pick<Database["public"]["Tables"]["meeting_rooms"]["Row"],"community_id"|"source_kind"|"mode"|"title"|"host_user_id"|"created_by">;
        Update: Partial<Database["public"]["Tables"]["meeting_rooms"]["Row"]>;Relationships:[];
      };
      meeting_chat_contexts:{
        Row:{room_id:string;community_id:string;channel_id:string;thread_id:string|null;context_kind:"linked_channel"|"dedicated_thread"|"meeting_source";preserve_after_meeting:boolean;guest_access_expires_at:string|null;created_by:string;created_at:string;updated_at:string};
        Insert:never;Update:never;Relationships:[];
      };
      meeting_chat_message_links:{
        Row:{message_id:string;room_id:string;session_id:string|null;linked_by_user_id:string|null;created_at:string};
        Insert:never;Update:never;Relationships:[];
      };
      meeting_sessions: {
        Row: { id:string;room_id:string;provider:"livekit";provider_room_name:string;status:"preparing"|"live"|"reconnecting"|"ended"|"failed";connection_state:string;started_by_user_id:string;ended_by_user_id:string|null;started_at:string|null;ended_at:string|null;participant_count:number;last_event_sequence:number;idempotency_key:string;metadata:Json;created_at:string;updated_at:string };
        Insert: Partial<Database["public"]["Tables"]["meeting_sessions"]["Row"]> & Pick<Database["public"]["Tables"]["meeting_sessions"]["Row"],"room_id"|"provider_room_name"|"started_by_user_id"|"idempotency_key">;
        Update: Partial<Database["public"]["Tables"]["meeting_sessions"]["Row"]>;Relationships:[];
      };
      meeting_session_participants: {
        Row: { id:string;session_id:string;user_id:string|null;provider_identity:string;display_name:string;role:"host"|"cohost"|"speaker"|"participant"|"viewer"|"guest";state:"invited"|"waiting"|"joining"|"connected"|"reconnecting"|"left"|"removed";capabilities:Json;screen_share_allowed:boolean;joined_at:string|null;left_at:string|null;last_seen_at:string|null;provider_joined_at:string|null;provider_left_at:string|null;last_provider_event_at:string|null;last_provider_event_id:string|null;last_provider_event_type:string|null;connection_generation:number;removed_by_user_id:string|null;removal_reason_code:string|null;created_at:string;updated_at:string };
        Insert: Partial<Database["public"]["Tables"]["meeting_session_participants"]["Row"]> & Pick<Database["public"]["Tables"]["meeting_session_participants"]["Row"],"session_id"|"provider_identity"|"display_name"|"role">;
        Update: Partial<Database["public"]["Tables"]["meeting_session_participants"]["Row"]>;Relationships:[];
      };
      meeting_waiting_entries: {
        Row: { id:string;room_id:string;session_id:string|null;user_id:string;display_name:string;requested_role:"host"|"cohost"|"speaker"|"participant"|"viewer"|"guest";status:"waiting"|"admitted"|"denied"|"expired"|"cancelled";idempotency_key:string;request_message:string;invite_id:string|null;invited_by_user_id:string|null;requested_at:string;expires_at:string;resolved_at:string|null;resolved_by_user_id:string|null;denial_reason_code:string|null;decision_note:string|null;decision_metadata:Json;cancelled_at:string|null;host_notified_at:string|null;created_at:string;updated_at:string };
        Insert: Partial<Database["public"]["Tables"]["meeting_waiting_entries"]["Row"]> & Pick<Database["public"]["Tables"]["meeting_waiting_entries"]["Row"],"room_id"|"user_id"|"display_name"|"idempotency_key">;
        Update: Partial<Database["public"]["Tables"]["meeting_waiting_entries"]["Row"]>;Relationships:[];
      };
      meeting_invites: {
        Row: { id:string;room_id:string;session_id:string|null;invited_user_id:string|null;invited_by_user_id:string;role:"host"|"cohost"|"speaker"|"participant"|"viewer"|"guest";status:"active"|"accepted"|"declined"|"revoked"|"expired";token_hash:string;token_hint:string|null;max_uses:number;use_count:number;created_at:string;expires_at:string|null;responded_at:string|null;last_used_at:string|null;revoked_at:string|null;revoked_by_user_id:string|null };
        Insert: Partial<Database["public"]["Tables"]["meeting_invites"]["Row"]> & Pick<Database["public"]["Tables"]["meeting_invites"]["Row"],"room_id"|"invited_by_user_id"|"role"|"token_hash">;
        Update: Partial<Database["public"]["Tables"]["meeting_invites"]["Row"]>;Relationships:[];
      };
      meeting_events: {
        Row: { id:string;room_id:string;session_id:string|null;actor_user_id:string|null;actor_participant_id:string|null;event_type:string;event_source:"backend"|"livekit"|"webhook"|"client";provider_event_id:string|null;idempotency_key:string;sequence:number;payload:Json;occurred_at:string;created_at:string };
        Insert: Partial<Database["public"]["Tables"]["meeting_events"]["Row"]> & Pick<Database["public"]["Tables"]["meeting_events"]["Row"],"room_id"|"event_type"|"event_source"|"idempotency_key"|"occurred_at">;
        Update: Partial<Database["public"]["Tables"]["meeting_events"]["Row"]>;Relationships:[];
      };
      meeting_notification_jobs:{
        Row:{id:string;recipient_id:string;actor_id:string|null;room_id:string;session_id:string|null;event_kind:"reminder"|"started"|"schedule_changed"|"cancelled"|"invite_received"|"waiting_request"|"admission_result"|"cohost_assigned"|"stage_request";event_key:string;title:string;preview:string;context_label:string;deep_link:string;meeting_starts_at:string|null;available_at:string;expires_at:string;attempt_count:number;max_attempts:number;processed_at:string|null;last_error_code:string|null;created_at:string;updated_at:string};
        Insert:never;Update:never;Relationships:[];
      };
      meeting_invite_redemptions: {
        Row:{id:string;invite_id:string;user_id:string;redeemed_at:string};
        Insert:Partial<Database["public"]["Tables"]["meeting_invite_redemptions"]["Row"]>&Pick<Database["public"]["Tables"]["meeting_invite_redemptions"]["Row"],"invite_id"|"user_id">;
        Update:Partial<Database["public"]["Tables"]["meeting_invite_redemptions"]["Row"]>;Relationships:[];
      };
      meeting_attendance: {
        Row: { id:string;session_id:string;user_id:string|null;participant_identity_hash:string;role:"host"|"cohost"|"speaker"|"participant"|"viewer"|"guest";joined_at:string;left_at:string|null;duration_seconds:number|null;reconnect_count:number;final_state:"left"|"removed"|"disconnected"|"ended";created_at:string;updated_at:string };
        Insert: Partial<Database["public"]["Tables"]["meeting_attendance"]["Row"]> & Pick<Database["public"]["Tables"]["meeting_attendance"]["Row"],"session_id"|"participant_identity_hash"|"role"|"joined_at">;
        Update: Partial<Database["public"]["Tables"]["meeting_attendance"]["Row"]>;Relationships:[];
      };
      livekit_webhook_receipts:{
        Row:{event_id:string;event_type:string;room_name:string;payload_digest:string;status:"processing"|"processed"|"failed";attempt_count:number;error_code:string|null;first_received_at:string;last_received_at:string;processed_at:string|null};
        Insert:never;Update:never;Relationships:[];
      };
      meeting_participant_tracks:{
        Row:{id:string;session_id:string;participant_id:string;provider_track_sid:string;kind:"audio"|"video";source:"microphone"|"camera"|"screen_share"|"screen_share_audio"|"unknown";state:"published"|"unpublished";published_at:string;unpublished_at:string|null;last_provider_event_at:string|null;last_provider_event_id:string|null;updated_at:string};
        Insert:never;Update:never;Relationships:[];
      };
      meeting_participant_runtime_state:{
        Row:{participant_id:string;session_id:string;hand_raised:boolean;hand_raised_at:string|null;hand_sequence:number;server_version:number;acknowledged_by_user_id:string|null;acknowledged_at:string|null;stage_request_status:"none"|"requested"|"approved"|"denied"|"cancelled";stage_requested_at:string|null;stage_resolved_at:string|null;stage_resolved_by_user_id:string|null;updated_by_user_id:string|null;updated_at:string};
        Insert:never;Update:never;Relationships:[];
      };
      community_event_rsvps: {
        Row: { id:string;event_id:string;user_id:string;status:"interested"|"going"|"not_going";created_at:string;updated_at:string };
        Insert: Partial<Database["public"]["Tables"]["community_event_rsvps"]["Row"]> & Pick<Database["public"]["Tables"]["community_event_rsvps"]["Row"],"event_id"|"user_id"|"status">;
        Update: Partial<Database["public"]["Tables"]["community_event_rsvps"]["Row"]>;Relationships:[];
      };
      community_event_reminders: {
        Row: { id:string;event_id:string;user_id:string;minutes_before:number;enabled:boolean;created_at:string;updated_at:string };
        Insert: Partial<Database["public"]["Tables"]["community_event_reminders"]["Row"]> & Pick<Database["public"]["Tables"]["community_event_reminders"]["Row"],"event_id"|"user_id">;
        Update: Partial<Database["public"]["Tables"]["community_event_reminders"]["Row"]>;Relationships:[];
      };
      saved_messages: {
        Row: { id: string; user_id: string; message_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["saved_messages"]["Row"]> & Pick<Database["public"]["Tables"]["saved_messages"]["Row"], "user_id" | "message_id">;
        Update: Partial<Database["public"]["Tables"]["saved_messages"]["Row"]>; Relationships: [];
      };
      blocked_users: {
        Row: { id: string; blocker_id: string; blocked_user_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["blocked_users"]["Row"]> & Pick<Database["public"]["Tables"]["blocked_users"]["Row"], "blocker_id" | "blocked_user_id">;
        Update: Partial<Database["public"]["Tables"]["blocked_users"]["Row"]>; Relationships: [];
      };
      user_follows: {
        Row: { id: string; follower_id: string; followed_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["user_follows"]["Row"]> & Pick<Database["public"]["Tables"]["user_follows"]["Row"], "follower_id" | "followed_id">;
        Update: Partial<Database["public"]["Tables"]["user_follows"]["Row"]>; Relationships: [];
      };
      message_mentions: {
        Row: { id: string; message_id: string; mentioned_user_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["message_mentions"]["Row"]> & Pick<Database["public"]["Tables"]["message_mentions"]["Row"], "message_id" | "mentioned_user_id">;
        Update: Partial<Database["public"]["Tables"]["message_mentions"]["Row"]>; Relationships: [];
      };
      content_mentions: {
        Row: {
          id: string; source_type: "text_message" | "radio_session" | "radio_chat" | "podcast_episode" | "podcast_comment";
          source_id: string; parent_source_id: string | null; community_id: string; channel_id: string | null;
          author_id: string; mentioned_user_id: string; preview: string; source_created_at: string;
          source_updated_at: string; visibility_context: Json; created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      voice_story_events: {
        Row: { id: string; author_id: string; community_id: string; channel_id: string; title: string; created_at: string; ended_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["voice_story_events"]["Row"]> & Pick<Database["public"]["Tables"]["voice_story_events"]["Row"], "author_id" | "community_id" | "channel_id" | "title">;
        Update: Partial<Database["public"]["Tables"]["voice_story_events"]["Row"]>; Relationships: [];
      };
      friend_requests: {
        Row: { id: string; sender_id: string; recipient_id: string; status: "pending" | "accepted" | "declined" | "cancelled"; created_at: string; responded_at: string | null; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["friend_requests"]["Row"]> & Pick<Database["public"]["Tables"]["friend_requests"]["Row"], "sender_id" | "recipient_id">;
        Update: Partial<Database["public"]["Tables"]["friend_requests"]["Row"]>; Relationships: [];
      };
      friendships: {
        Row: { id: string; user_low_id: string; user_high_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["friendships"]["Row"]> & Pick<Database["public"]["Tables"]["friendships"]["Row"], "user_low_id" | "user_high_id">;
        Update: Partial<Database["public"]["Tables"]["friendships"]["Row"]>; Relationships: [];
      };
      direct_conversations: {
        Row: { id: string; type: "direct"; created_by: string; created_at: string; updated_at: string; last_message_at: string | null; participant_low_id: string | null; participant_high_id: string | null; superseded_by: string | null };
        Insert: Partial<Database["public"]["Tables"]["direct_conversations"]["Row"]> & Pick<Database["public"]["Tables"]["direct_conversations"]["Row"], "created_by">;
        Update: Partial<Database["public"]["Tables"]["direct_conversations"]["Row"]>;
        Relationships: [];
      };
      friend_presence: {
        Row: { user_id: string; status: "online" | "idle" | "dnd" | "offline"; share_presence: boolean; last_seen_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["friend_presence"]["Row"]> & Pick<Database["public"]["Tables"]["friend_presence"]["Row"], "user_id">;
        Update: Partial<Database["public"]["Tables"]["friend_presence"]["Row"]>;
        Relationships: [];
      };
      direct_conversation_participants: {
        Row: { id: string; conversation_id: string; user_id: string; joined_at: string; last_read_at: string | null; last_read_message_id: string | null; muted_until: string | null; archived_at: string | null; blocked_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["direct_conversation_participants"]["Row"]> & Pick<Database["public"]["Tables"]["direct_conversation_participants"]["Row"], "conversation_id" | "user_id">;
        Update: Partial<Database["public"]["Tables"]["direct_conversation_participants"]["Row"]>;
        Relationships: [];
      };
      direct_messages: {
        Row: { id: string; conversation_id: string; author_id: string; body: string | null; reply_to_message_id: string | null; client_message_id: string | null; created_at: string; updated_at: string; edited_at: string | null; deleted_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["direct_messages"]["Row"]> & Pick<Database["public"]["Tables"]["direct_messages"]["Row"], "conversation_id" | "author_id">;
        Update: Partial<Database["public"]["Tables"]["direct_messages"]["Row"]>;
        Relationships: [];
      };
      direct_message_reactions: {
        Row: { id: string; message_id: string; user_id: string; emoji: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["direct_message_reactions"]["Row"]> & Pick<Database["public"]["Tables"]["direct_message_reactions"]["Row"], "message_id" | "user_id" | "emoji">;
        Update: Partial<Database["public"]["Tables"]["direct_message_reactions"]["Row"]>;
        Relationships: [];
      };
      direct_message_attachments: {
        Row: { id: string; message_id: string; url: string; file_name: string | null; mime_type: string | null; file_size: number | null; width: number | null; height: number | null; uploader_id: string | null; storage_path: string | null; size_bytes: number | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["direct_message_attachments"]["Row"]> & Pick<Database["public"]["Tables"]["direct_message_attachments"]["Row"], "message_id" | "url">;
        Update: Partial<Database["public"]["Tables"]["direct_message_attachments"]["Row"]>;
        Relationships: [];
      };
      read_states: {
        Row: {
          id: string;
          user_id: string;
          channel_id: string;
          last_read_message_id: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["read_states"]["Row"]> & Pick<Database["public"]["Tables"]["read_states"]["Row"], "user_id" | "channel_id">;
        Update: Partial<Database["public"]["Tables"]["read_states"]["Row"]>;
        Relationships: [];
      };
      community_invites: {
        Row: { id: string; community_id: string; code: string; created_by: string; max_uses: number | null; uses: number; expires_at: string | null; revoked_at: string | null; created_at: string; campaign_label: string | null; last_used_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["community_invites"]["Row"]> & Pick<Database["public"]["Tables"]["community_invites"]["Row"], "community_id" | "code" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["community_invites"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string | null;
          category: "mention" | "reply" | "reaction" | "dm" | "event" | "system";
          title: string;
          preview: string;
          context_kind: "community" | "dm" | "system";
          context_label: string;
          community_id: string | null;
          channel_id: string | null;
          message_id: string | null;
          podcast_episode_id: string | null;
          meeting_room_id: string | null;
          meeting_session_id: string | null;
          meeting_starts_at: string | null;
          deep_link: string | null;
          user_id: string | null;
          source_event_id: string | null;
          created_at: string;
          read_at: string | null;
          deleted_at: string | null;
        };
        Insert: never;
        Update: Partial<Pick<Database["public"]["Tables"]["notifications"]["Row"], "read_at" | "deleted_at">>;
        Relationships: [];
      };
      community_voice_usage_daily: {
        Row: { community_id: string; usage_date: string; session_count: number; participant_minutes: number; peak_concurrent: number; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      friend_request_notifications: {
        Row: { id: string; recipient_id: string; actor_id: string; request_id: string | null; event_type: "request_sent" | "request_accepted"; created_at: string; read_at: string | null };
        Insert: never; Update: Pick<Database["public"]["Tables"]["friend_request_notifications"]["Row"], "read_at">; Relationships: [];
      };
      app_admins: {
        Row: { user_id: string; granted_by: string | null; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      verification_badges: {
        Row:{id:string;subject_type:"user"|"community"|"role";subject_id:string;badge_kind:"profile_reviewed"|"community_official"|"role_managed";label:string;scope_note:string;granted_by:string;granted_at:string;revoked_at:string|null;revoked_by:string|null};Insert:never;Update:never;Relationships:[];
      };
      profile_privacy_settings:{Row:{user_id:string;profile_visibility:"everyone"|"shared_communities"|"friends";show_online_status:boolean;show_location:boolean;show_timezone:boolean;show_activity:boolean;show_media:boolean;show_communities:boolean;show_friends:boolean;show_follows:boolean;show_audio:boolean;location:string|null;timezone:string|null;updated_at:string};Insert:never;Update:never;Relationships:[]};
      data_export_requests: {
        Row: { id: string; user_id: string; status: "requested" | "processing" | "ready" | "failed"; format: "json"; requested_at: string; completed_at: string | null; expires_at: string | null; failure_code: string | null };
        Insert: Partial<Database["public"]["Tables"]["data_export_requests"]["Row"]> & Pick<Database["public"]["Tables"]["data_export_requests"]["Row"], "user_id">;
        Update: never;
        Relationships: [];
      };
      account_deletion_requests: {
        Row: { id: string; user_id: string; status: "requested" | "reviewing" | "canceled" | "completed"; requested_at: string; canceled_at: string | null; completed_at: string | null; anonymize_after: string | null; sessions_revoked_at: string | null; session_revocation_status: "pending" | "completed" | "failed"; finalization_status: "pending" | "profile_anonymized" | "auth_soft_delete_failed" | "completed" };
        Insert: Partial<Database["public"]["Tables"]["account_deletion_requests"]["Row"]> & Pick<Database["public"]["Tables"]["account_deletion_requests"]["Row"], "user_id">;
        Update: never;
        Relationships: [];
      };
      account_security_events: {
        Row: { id: string; user_id: string; event_type: "account_deletion_requested" | "account_deletion_canceled" | "account_sessions_revoked"; request_id: string | null; metadata: Record<string, unknown>; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_device_sessions:{Row:{id:string;user_id:string;device_id:string;session_hash:string;device_label:string;platform_label:string;runtime_label:string;created_at:string;last_used_at:string;expires_at:string|null;revoked_at:string|null};Insert:never;Update:never;Relationships:[]};
      legal_policy_versions: {
        Row: { policy_key: "terms" | "privacy"; current_version: string; effective_at: string; requires_reaccept: boolean; updated_at: string };
        Insert: never; Update: never; Relationships: [];
      };
      legal_acceptance_events: {
        Row: { id: string; user_id: string; terms_version: string; privacy_version: string; accepted_at: string; source: "registration" | "reaccept" };
        Insert: never; Update: never; Relationships: [];
      };
      threads: {
        Row: { id: string; community_id: string; channel_id: string; parent_message_id: string; name: string; created_by: string; created_at: string; archived_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["threads"]["Row"]> & Pick<Database["public"]["Tables"]["threads"]["Row"], "community_id" | "channel_id" | "parent_message_id" | "name" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["threads"]["Row"]>;
        Relationships: [];
      };
      thread_read_states: {
        Row: { thread_id: string; user_id: string; last_read_at: string };
        Insert: Database["public"]["Tables"]["thread_read_states"]["Row"];
        Update: Partial<Database["public"]["Tables"]["thread_read_states"]["Row"]>;
        Relationships: [];
      };
      announcement_channel_followers: {
        Row: { channel_id: string; user_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["announcement_channel_followers"]["Row"]> & Pick<Database["public"]["Tables"]["announcement_channel_followers"]["Row"], "channel_id" | "user_id">;
        Update: never;
        Relationships: [];
      };
      forum_posts: {
        Row: { id: string; community_id: string; channel_id: string; parent_message_id: string; thread_id: string; title: string; body: string; author_id: string; tags: string[]; status: "open" | "resolved"; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["forum_posts"]["Row"]> & Pick<Database["public"]["Tables"]["forum_posts"]["Row"], "channel_id" | "title" | "author_id">;
        Update: Partial<Database["public"]["Tables"]["forum_posts"]["Row"]>;
        Relationships: [];
      };
      bots: {
        Row: { id: string; profile_id: string; owner_id: string; display_name: string; avatar_url: string | null; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      community_bots: {
        Row: { community_id: string; bot_id: string; role_id: string; installed_by: string; installed_at: string };
        Insert: Partial<Database["public"]["Tables"]["community_bots"]["Row"]> & Pick<Database["public"]["Tables"]["community_bots"]["Row"], "community_id" | "bot_id" | "role_id" | "installed_by">;
        Update: Partial<Database["public"]["Tables"]["community_bots"]["Row"]>;
        Relationships: [];
      };
      bot_credentials: {
        Row: { id: string; bot_id: string; token_prefix: string; token_hash: string; hash_algorithm: "sha256"; created_by: string; created_at: string; last_used_at: string | null; revoked_at: string | null };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      bot_action_rate_limits: {
        Row: { credential_id: string; action_key: "api_request" | "message_send" | "reaction_write" | "event_delivery" | "command_invoke"; window_started_at: string; request_count: number; denied_count: number; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reports: {
        Row: { id: string; community_id: string | null; conversation_id: string | null; reporter_id: string; target_type: "message" | "direct_message" | "user" | "community" | "podcast_episode" | "podcast_comment"; target_id: string; reason: "spam" | "harassment" | "unsafe_content" | "impersonation" | "copyright" | "other"; description: string; evidence_excerpt: string | null; status: "open" | "reviewed" | "dismissed" | "action_taken"; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["reports"]["Row"]> & Pick<Database["public"]["Tables"]["reports"]["Row"], "reporter_id" | "target_type" | "target_id" | "reason" | "description">;
        Update: Partial<Database["public"]["Tables"]["reports"]["Row"]>;
        Relationships: [];
      };
      moderation_action_records: {
        Row: { id: string; community_id: string; affected_user_id: string; actor_id: string | null; action_type: "ban" | "kick" | "timeout" | "message_delete" | "other"; target_id: string | null; reason_code: string; appealable: boolean; appealable_until: string | null; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      moderation_appeals: {
        Row: { id: string; community_id: string; affected_user_id: string; moderation_action_id: string; reason: string; status: "open" | "under_review" | "accepted" | "denied" | "closed"; decision_note: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["moderation_appeals"]["Row"]> & Pick<Database["public"]["Tables"]["moderation_appeals"]["Row"], "community_id" | "affected_user_id" | "moderation_action_id" | "reason">;
        Update: Pick<Partial<Database["public"]["Tables"]["moderation_appeals"]["Row"]>, "status" | "decision_note" | "reviewed_by" | "updated_at">;
        Relationships: [];
      };
      abuse_events: {
        Row: { id: number; event_type: string; severity: "info" | "warning" | "critical"; community_id: string | null; reason_code: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_log: {
        Row: { id: string; community_id: string; actor_id: string; action_type: string; target_type: string; target_id: string | null; reason: string | null; meeting_room_id: string | null; meeting_session_id: string | null; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      webhooks: {
        Row: { id: string; community_id: string; channel_id: string; name: string; avatar_url: string | null; token_hash: string; created_by: string; revoked_at: string | null; created_at: string; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      community_emojis: {
        Row: { id: string; community_id: string; name: string; image_url: string; storage_path: string | null; created_by: string; created_at: string; moderation_status: "active" | "disabled"; disabled_at: string | null; deleted_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["community_emojis"]["Row"]> & Pick<Database["public"]["Tables"]["community_emojis"]["Row"], "community_id" | "name" | "image_url" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["community_emojis"]["Row"]>;
        Relationships: [];
      };
      community_stickers: {
        Row: { id: string; pack_id: string | null; community_id: string; name: string; title: string; image_url: string; storage_path: string | null; created_by: string; created_at: string; moderation_status: "active" | "disabled"; disabled_at: string | null; deleted_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["community_stickers"]["Row"]> & Pick<Database["public"]["Tables"]["community_stickers"]["Row"], "community_id" | "name" | "image_url" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["community_stickers"]["Row"]>;
        Relationships: [];
      };
      community_sticker_packs: {
        Row: { id: string; community_id: string; name: string; description: string; created_by: string; created_at: string; moderation_status: "active" | "disabled"; deleted_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["community_sticker_packs"]["Row"]> & Pick<Database["public"]["Tables"]["community_sticker_packs"]["Row"], "community_id" | "name" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["community_sticker_packs"]["Row"]>;
        Relationships: [];
      };
      polls: {
        Row: { id: string; message_id: string; question: string; allow_multiple: boolean; closes_at: string | null; closed_at: string | null; closed_by: string | null; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["polls"]["Row"]> & Pick<Database["public"]["Tables"]["polls"]["Row"], "message_id" | "question">;
        Update: Partial<Database["public"]["Tables"]["polls"]["Row"]>;
        Relationships: [];
      };
      poll_options: {
        Row: { id: string; poll_id: string; text: string; position: number };
        Insert: Partial<Database["public"]["Tables"]["poll_options"]["Row"]> & Pick<Database["public"]["Tables"]["poll_options"]["Row"], "poll_id" | "text" | "position">;
        Update: Partial<Database["public"]["Tables"]["poll_options"]["Row"]>;
        Relationships: [];
      };
      poll_votes: {
        Row: { id: string; poll_id: string; option_id: string; user_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["poll_votes"]["Row"]> & Pick<Database["public"]["Tables"]["poll_votes"]["Row"], "poll_id" | "option_id" | "user_id">;
        Update: never;
        Relationships: [];
      };
      radio_community_settings: {
        Row: { community_id: string; schedule_timezone: string; listener_chat_enabled: boolean; listener_chat_channel_id: string | null; announcements_enabled: boolean; default_host_role: "owner" | "host"; schedule_visibility: "public" | "members"; listener_rules: string; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_community_settings"]["Row"]> & Pick<Database["public"]["Tables"]["radio_community_settings"]["Row"], "community_id">;
        Update: Partial<Database["public"]["Tables"]["radio_community_settings"]["Row"]>;
        Relationships: [];
      };
      radio_programs: {
        Row: { id: string; community_id: string; title: string; description: string; host_user_id: string | null; created_by: string; slug: string | null; cover_url: string | null; cover_storage_path: string | null; tags: string[]; default_duration_minutes: number; is_active: boolean; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_programs"]["Row"]> & Pick<Database["public"]["Tables"]["radio_programs"]["Row"], "community_id" | "title" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["radio_programs"]["Row"]>;
        Relationships: [];
      };
      radio_program_schedules: {
        Row: { id: string; program_id: string; community_id: string; weekday: number; starts_at_local: string; duration_minutes: number; timezone: string; effective_from: string; effective_until: string | null; is_active: boolean; created_by: string; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_program_schedules"]["Row"]> & Pick<Database["public"]["Tables"]["radio_program_schedules"]["Row"], "program_id" | "community_id" | "weekday" | "starts_at_local" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["radio_program_schedules"]["Row"]>;
        Relationships: [];
      };
      radio_program_hosts: {
        Row: { id: string; program_id: string; user_id: string; host_role: "host" | "co_host" | "producer"; assigned_by: string; assigned_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_program_hosts"]["Row"]> & Pick<Database["public"]["Tables"]["radio_program_hosts"]["Row"], "program_id" | "user_id" | "assigned_by">;
        Update: Partial<Database["public"]["Tables"]["radio_program_hosts"]["Row"]>;
        Relationships: [];
      };
      radio_announcements: {
        Row: { id: string; community_id: string; author_id: string; body: string; published_at: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_announcements"]["Row"]> & Pick<Database["public"]["Tables"]["radio_announcements"]["Row"], "community_id" | "author_id" | "body">;
        Update: Partial<Database["public"]["Tables"]["radio_announcements"]["Row"]>;
        Relationships: [];
      };
      radio_sessions: {
        Row: { id: string; community_id: string; channel_id: string | null; program_id: string | null; host_user_id: string; title: string; description: string; status: "draft" | "scheduled" | "live" | "ended" | "cancelled"; starts_at: string; scheduled_end_at: string | null; actual_started_at: string | null; ended_at: string | null; listener_chat_channel_id: string | null; cover_url: string | null; cover_storage_path: string | null; stream_url: string | null; tags: string[]; is_featured: boolean; listener_count: number; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_sessions"]["Row"]> & Pick<Database["public"]["Tables"]["radio_sessions"]["Row"], "community_id" | "host_user_id" | "title" | "starts_at">;
        Update: Partial<Database["public"]["Tables"]["radio_sessions"]["Row"]>;
        Relationships: [];
      };
      radio_listeners: {
        Row: { id: string; radio_session_id: string; user_id: string; joined_at: string; left_at: string | null; muted: boolean; last_heartbeat_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_listeners"]["Row"]> & Pick<Database["public"]["Tables"]["radio_listeners"]["Row"], "radio_session_id" | "user_id">;
        Update: Partial<Database["public"]["Tables"]["radio_listeners"]["Row"]>;
        Relationships: [];
      };
      radio_session_hosts: {
        Row: { id: string; radio_session_id: string; user_id: string; host_role: "host" | "co_host" | "producer"; assigned_by: string; assigned_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_session_hosts"]["Row"]> & Pick<Database["public"]["Tables"]["radio_session_hosts"]["Row"], "radio_session_id" | "user_id" | "assigned_by">;
        Update: Partial<Database["public"]["Tables"]["radio_session_hosts"]["Row"]>;
        Relationships: [];
      };
      radio_program_follows: {
        Row: { id: string; program_id: string; user_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_program_follows"]["Row"]> & Pick<Database["public"]["Tables"]["radio_program_follows"]["Row"], "program_id" | "user_id">;
        Update: never;
        Relationships: [];
      };
      radio_session_reminders: {
        Row: { id: string; radio_session_id: string; user_id: string; remind_minutes_before: number; last_known_starts_at: string; last_known_status: "draft" | "scheduled" | "live" | "ended" | "cancelled"; last_notification_key: string | null; last_notified_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_session_reminders"]["Row"]> & Pick<Database["public"]["Tables"]["radio_session_reminders"]["Row"], "radio_session_id" | "user_id" | "last_known_starts_at" | "last_known_status">;
        Update: Partial<Pick<Database["public"]["Tables"]["radio_session_reminders"]["Row"], "remind_minutes_before" | "last_known_starts_at" | "last_known_status" | "last_notification_key" | "last_notified_at" | "updated_at">>;
        Relationships: [];
      };
      audio_feed_read_states: {
        Row: { id: string; user_id: string; item_type: "radio_session" | "podcast_episode"; item_id: string; read_at: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["audio_feed_read_states"]["Row"]> & Pick<Database["public"]["Tables"]["audio_feed_read_states"]["Row"], "user_id" | "item_type" | "item_id">;
        Update: Partial<Pick<Database["public"]["Tables"]["audio_feed_read_states"]["Row"], "read_at">>;
        Relationships: [];
      };
      radio_session_reactions: {
        Row: { id: string; radio_session_id: string; user_id: string; emoji: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["radio_session_reactions"]["Row"]> & Pick<Database["public"]["Tables"]["radio_session_reactions"]["Row"], "radio_session_id" | "user_id" | "emoji">;
        Update: never;
        Relationships: [];
      };
      podcast_community_settings: {
        Row: { community_id: string; about: string; listener_discussion_enabled: boolean; listener_discussion_channel_id: string | null; default_publisher_role: "owner" | "publisher"; comments_enabled: boolean; explicit_content_default: boolean; comment_rules: string; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["podcast_community_settings"]["Row"]> & Pick<Database["public"]["Tables"]["podcast_community_settings"]["Row"], "community_id">;
        Update: Partial<Database["public"]["Tables"]["podcast_community_settings"]["Row"]>;
        Relationships: [];
      };
      podcast_series: {
        Row: { id: string; community_id: string; title: string; description: string; cover_url: string | null; cover_storage_path: string | null; tags: string[]; created_by: string; is_active: boolean; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["podcast_series"]["Row"]> & Pick<Database["public"]["Tables"]["podcast_series"]["Row"], "community_id" | "title" | "created_by">;
        Update: Partial<Database["public"]["Tables"]["podcast_series"]["Row"]>;
        Relationships: [];
      };
      podcast_episodes: {
        Row: { id: string; community_id: string; series_id: string | null; author_user_id: string; host_user_id: string | null; title: string; description: string; cover_url: string | null; cover_storage_path: string | null; audio_url: string | null; audio_storage_path: string | null; audio_mime_type: "audio/mpeg" | "audio/mp4" | "audio/ogg" | "audio/wav" | "audio/webm" | null; audio_size_bytes: number | null; duration_seconds: number; is_explicit: boolean; tags: string[]; status: "draft" | "published" | "archived"; published_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["podcast_episodes"]["Row"]> & Pick<Database["public"]["Tables"]["podcast_episodes"]["Row"], "community_id" | "author_user_id" | "title">;
        Update: Partial<Database["public"]["Tables"]["podcast_episodes"]["Row"]>;
        Relationships: [];
      };
      podcast_episode_reactions: {
        Row: { id: string; episode_id: string; user_id: string; emoji: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["podcast_episode_reactions"]["Row"]> & Pick<Database["public"]["Tables"]["podcast_episode_reactions"]["Row"], "episode_id" | "user_id" | "emoji">;
        Update: Partial<Database["public"]["Tables"]["podcast_episode_reactions"]["Row"]>;
        Relationships: [];
      };
      podcast_episode_comments: {
        Row: { id: string; episode_id: string; author_id: string | null; reply_to_comment_id: string | null; body: string; created_at: string; updated_at: string; deleted_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["podcast_episode_comments"]["Row"]> & Pick<Database["public"]["Tables"]["podcast_episode_comments"]["Row"], "episode_id" | "body">;
        Update: Partial<Database["public"]["Tables"]["podcast_episode_comments"]["Row"]>;
        Relationships: [];
      };
      podcast_playback_progress: {
        Row: { id: string; user_id: string; episode_id: string; position_seconds: number; duration_seconds: number; completed_at: string | null; last_played_at: string; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["podcast_playback_progress"]["Row"]> & Pick<Database["public"]["Tables"]["podcast_playback_progress"]["Row"], "user_id" | "episode_id" | "position_seconds" | "duration_seconds">;
        Update: Partial<Pick<Database["public"]["Tables"]["podcast_playback_progress"]["Row"], "position_seconds" | "duration_seconds" | "completed_at" | "last_played_at" | "updated_at">>;
        Relationships: [];
      };
      saved_audio_items: {
        Row: { id: string; user_id: string; item_type: "radio_session" | "podcast_episode"; item_id: string; created_at: string };
        Insert: Partial<Database["public"]["Tables"]["saved_audio_items"]["Row"]> & Pick<Database["public"]["Tables"]["saved_audio_items"]["Row"], "user_id" | "item_type" | "item_id">;
        Update: Partial<Database["public"]["Tables"]["saved_audio_items"]["Row"]>;
        Relationships: [];
      };
      user_settings: {
        Row: { user_id: string; schema_version: number; theme_mode: "light" | "dark" | "system"; notification_settings: Json; updated_at: string };
        Insert: { user_id: string; schema_version?: number; theme_mode?: "light" | "dark" | "system"; notification_settings?: Json; updated_at?: string };
        Update: { schema_version?: number; theme_mode?: "light" | "dark" | "system"; notification_settings?: Json; updated_at?: string };
        Relationships: [];
      };
    };
    Views: {
      message_attachments: {
        Row: Database["public"]["Tables"]["attachments"]["Row"];
        Relationships: [];
      };
      mention_feed_view: {
        Row: {
          message_id: string; community_id: string; channel_id: string; author_id: string; mentioned_user_ids: string[];
          body: string; title: string | null; created_at: string; source: "popular_feed" | "following";
          attachments: Json; reactions: Json; view_count: number; comment_count: number; commenter_ids: string[];
          popularity_score: number; is_saved: boolean; comment_preview: Json; is_unread: boolean;
        };
        Relationships: [];
      };
      unified_content_feed_view: {
        Row: {
          feed_item_id: string; source_type: "text_message" | "radio_session" | "radio_chat" | "podcast_episode" | "podcast_comment";
          source_id: string; parent_source_id: string | null; community_id: string; channel_id: string | null; author_id: string;
          mentioned_user_ids: string[]; preview: string; source_created_at: string; source_updated_at: string;
          visibility_context: Json; mention_count: number;
        };
        Relationships: [];
      };
      followed_user_stories_view: {
        Row: {
          story_id: string; author_id: string; community_id: string | null; channel_id: string | null; message_id: string | null;
          story_type: string; title: string; subtitle: string | null; body: string | null; image_url: string | null;
          gradient_variant: string | null; created_at: string; duration_seconds: number; mentioned_user_ids: string[];
        };
        Relationships: [];
      };
      followed_content_stories_view: {
        Row: { story_id: string; author_id: string; community_id: string | null; channel_id: string | null; message_id: string | null;
          source_type: "profile_status" | "text_message" | "radio_chat" | "radio_session" | "podcast_episode" | "podcast_comment" | "voice" | "event" | null;
          source_id: string | null; parent_source_id: string | null; story_type: string; title: string; subtitle: string | null;
          body: string | null; image_url: string | null; gradient_variant: string | null; created_at: string; duration_seconds: number; mentioned_user_ids: string[] };
        Relationships: [];
      };
    };
    Functions: {
      create_community_role: { Args: { target_community_id: string; target_name: string; target_color: string; target_icon: string | null; target_level: number; target_permissions: Json; change_reason: string }; Returns: Array<Database["public"]["Tables"]["roles"]["Row"]> };
      update_community_role: { Args: { target_community_id: string; target_role_id: string; target_name: string; target_color: string; target_icon: string | null; target_level: number; target_permissions: Json; change_reason: string }; Returns: Array<Database["public"]["Tables"]["roles"]["Row"]> };
      swap_community_role_order: { Args: { target_community_id: string; target_role_id: string; adjacent_role_id: string; change_reason: string }; Returns: Array<Database["public"]["Tables"]["roles"]["Row"]> };
      delete_community_role: { Args: { target_community_id: string; target_role_id: string; change_reason: string }; Returns: boolean };
      set_community_member_roles: { Args: { target_community_id: string; target_member_id: string; target_role_ids: string[]; change_reason: string }; Returns: Array<{ member_id: string; community_id: string; user_id: string; primary_role_id: string; role_ids: string[] }> };
      join_current_user_radio_listener: { Args: { target_session_id: string }; Returns: Array<Database["public"]["Tables"]["radio_listeners"]["Row"]> };
      leave_current_user_radio_listener: { Args: { target_session_id: string }; Returns: boolean };
      heartbeat_current_user_radio_listener: { Args: { target_session_id: string }; Returns: boolean };
      assign_radio_session_host: { Args: { target_session_id: string; target_user_id: string; target_host_role?: string }; Returns: boolean };
      remove_radio_session_host: { Args: { target_session_id: string; target_user_id: string }; Returns: boolean };
      list_radio_session_audit: { Args: { target_session_id: string; result_limit?: number }; Returns: Array<{ id: string; actor_id: string; action_type: string; target_type: string; reason: string | null; created_at: string }> };
      transition_radio_session: { Args: { target_session_id: string; next_status: string; confirmation_session_title?: string | null }; Returns: Array<Database["public"]["Tables"]["radio_sessions"]["Row"]> };
      moderate_radio_listener: { Args: { target_session_id: string; target_user_id: string; moderation_action: string }; Returns: boolean };
      transfer_community_ownership: {
        Args: { target_community_id: string; target_new_owner_id: string; confirmation_community_name: string; transfer_reason: string };
        Returns: Array<{ community_id: string; previous_owner_id: string; new_owner_id: string; transferred_at: string }>;
      };
      archive_community: {
        Args: { target_community_id: string; confirmation_community_name: string; archive_reason?: string };
        Returns: Array<{ community_id: string; archived_at: string; archived_by: string }>;
      };
      create_text_community_with_defaults: {
        Args: {
          target_creation_request_id: string;
          community_name: string;
          community_description?: string | null;
          community_icon_url?: string | null;
          community_accent_color?: string;
          community_visibility?: "public" | "private";
          community_public_read_enabled?: boolean;
          community_template_id?: string;
        };
        Returns: Array<Database["public"]["Tables"]["communities"]["Row"]>;
      };
      create_radio_community_with_defaults: {
        Args: {
          target_creation_request_id: string;
          community_name: string;
          community_description?: string | null;
          community_icon_url?: string | null;
          community_accent_color?: string;
          community_visibility?: "public" | "private";
          community_public_read_enabled?: boolean;
        };
        Returns: Array<Database["public"]["Tables"]["communities"]["Row"]>;
      };
      create_podcast_community_with_defaults: {
        Args: {
          target_creation_request_id: string;
          community_name: string;
          community_description?: string | null;
          community_icon_url?: string | null;
          community_accent_color?: string;
          community_visibility?: "public" | "private";
          community_public_read_enabled?: boolean;
        };
        Returns: Array<Database["public"]["Tables"]["communities"]["Row"]>;
      };
      accept_current_legal_terms: { Args: Record<string, never>; Returns: Array<{ terms_version: string; privacy_version: string; accepted_at: string }> };
      request_current_user_account_deletion: { Args: { confirmation_username: string }; Returns: Array<{ request_id: string; requested_at: string; anonymize_after: string }> };
      cancel_current_user_account_deletion: { Args: Record<string, never>; Returns: Array<{ request_id: string; canceled_at: string }> };
      list_public_discovery_communities: {
        Args: { search_text?: string | null; category_filter?: string | null; result_limit?: number };
        Returns: Array<{ id: string; name: string; description: string | null; icon_url: string | null; accent_color: string; category: string | null; member_count: number; join_policy: "open" | "request" }>;
      };
      join_or_request_discovery_community: { Args: { target_community_id: string }; Returns: "joined" | "requested" | "already_member" };
      list_discovery_review_queue: {
        Args: { status_filter?: string | null; result_limit?: number };
        Returns: Array<{ community_id: string; community_name: string; description: string | null; icon_url: string | null; category: string | null; content_flags: string[]; review_status: "pending" | "approved" | "rejected" | "hidden" | "suspended"; report_count: number; submitted_at: string; reviewed_at: string | null }>;
      };
      review_discovery_listing: { Args: { target_community_id: string; next_status: string; review_reason?: string | null }; Returns: boolean };
      search_accessible_entities: {
        Args: { query_text: string; category_filter?: string | null; result_limit?: number };
        Returns: Array<{ result_type: "community" | "channel" | "member" | "message" | "mention" | "saved_message"; entity_id: string; label: string; detail: string; community_id: string | null; channel_id: string | null; message_id: string | null; user_id: string | null; created_at: string; rank: number }>;
      };
      users_are_blocked: { Args: { first_user_id: string; second_user_id: string }; Returns: boolean };
      respond_friend_request: { Args: { target_request_id: string; accept_request: boolean }; Returns: boolean };
      send_friend_request: { Args: { target_user_id: string }; Returns: string };
      cancel_friend_request: { Args: { target_request_id: string }; Returns: boolean };
      list_friend_relationship_state: { Args: Record<string, never>; Returns: Json };
      list_friend_suggestions: { Args: { result_limit?: number }; Returns: Array<{ user_id: string; display_name: string; username: string; avatar_url: string | null; mutual_community_count: number; followed_by_current_user: boolean }> };
      set_my_friend_presence: { Args: { target_status: string; share_presence: boolean }; Returns: undefined };
      list_friend_presence: { Args: { target_user_ids: string[] }; Returns: Array<{ user_id: string; status: string; status_text: string; last_seen_at: string | null }> };
      block_user: { Args: { target_user_id: string }; Returns: boolean };
      unblock_user: { Args: { target_user_id: string }; Returns: boolean };
      list_blocked_users: { Args: Record<string, never>; Returns: Array<{ user_id: string; display_name: string; username: string; blocked_at: string }> };
      remove_friend: { Args: { other_user_id: string }; Returns: boolean };
      create_direct_conversation: { Args: { other_user_id: string }; Returns: string };
      list_direct_conversations: { Args: { result_limit?: number }; Returns: Array<{ id: string; participant_user_id: string; participant_name: string; participant_username: string; participant_status: string; participant_status_text: string; last_message_preview: string; updated_at: string; unread_count: number }> };
      send_direct_message: { Args: { target_conversation_id: string; message_body: string; target_client_message_id: string }; Returns: Json };
      send_direct_message_v2: { Args: { target_conversation_id: string; message_body: string; target_client_message_id: string; target_reply_to_message_id: string | null }; Returns: Json };
      send_direct_message_v3: { Args: { target_conversation_id: string; message_body: string; target_client_message_id: string; target_reply_to_message_id: string | null; target_attachments?: Json }; Returns: Json };
      edit_direct_message: { Args: { target_message_id: string; message_body: string }; Returns: Json };
      delete_direct_message: { Args: { target_message_id: string }; Returns: Json };
      set_direct_conversation_preferences: { Args: { target_conversation_id: string; target_muted_until: string | null; target_archived: boolean }; Returns: boolean };
      mark_direct_conversation_read: { Args: { target_conversation_id: string }; Returns: boolean };
      mark_direct_conversation_read_to: { Args: { target_conversation_id: string; target_message_id: string }; Returns: boolean };
      set_direct_conversation_muted: { Args: { target_conversation_id: string; target_muted_until: string | null }; Returns: boolean };
      set_direct_conversation_archived: { Args: { target_conversation_id: string; target_archived: boolean }; Returns: boolean };
      list_direct_shared_media: { Args: { target_conversation_id: string; before_created_at?: string | null; before_attachment_id?: string | null; result_limit?: number }; Returns: Array<{ id: string; message_id: string; url: string; file_name: string | null; mime_type: string | null; file_size: number | null; width: number | null; height: number | null; created_at: string }> };
      accept_community_invite: {
        Args: { invite_code: string };
        Returns: Array<{ id: string; community_id: string; user_id: string; role_id: string | null; joined_at: string }>;
      };
      accept_community_invite_v2: {
        Args: { invite_code: string };
        Returns: Array<{ id: string; community_id: string; user_id: string; role_id: string; joined_at: string; acceptance_status: "joined" | "already_member" }>;
      };
      join_public_community: {
        Args: { target_community_id: string; accepted_rules_version?: string | null };
        Returns: Array<{ id: string; community_id: string; user_id: string; role_id: string | null; joined_at: string; join_status: "joined" | "already_member" }>;
      };
      assign_community_member_role: {
        Args: { target_community_id: string; target_member_id: string; target_role_id: string; change_reason: string };
        Returns: Array<{ id: string; community_id: string; user_id: string; role_id: string; joined_at: string }>;
      };
      update_community_settings: {
        Args: { target_community_id: string; next_name: string | null; next_description: string | null; next_icon_url: string | null; next_banner_url: string | null; next_visibility: "public" | "private" | null; next_public_read_enabled: boolean | null; next_default_notification_level: "all" | "mentions" | "none" | null; next_rules_enabled: boolean | null; next_rules_version: string | null; next_type_settings: Json | null; next_rules: Json | null };
        Returns: Array<Database["public"]["Tables"]["communities"]["Row"]>;
      };
      community_voice_rooms_enabled: { Args: { target_community_id: string }; Returns: boolean };
      authorize_livekit_room: { Args: { target_community_id: string; target_channel_id: string; target_intent: "voice" | "screen" }; Returns: Array<{ community_id: string; channel_id: string; community_kind: Database["public"]["Enums"]["community_kind"]; channel_private: boolean; can_publish_audio: boolean; can_publish_screen: boolean }> };
      authorize_livekit_voice_moderation: { Args: { target_community_id: string; target_channel_id: string; target_user_id: string; target_action: "mute" | "remove" }; Returns: Array<{ community_id: string; channel_id: string; moderated_user_id: string; action: "mute" | "remove" }> };
      record_livekit_voice_moderation: { Args: { target_community_id: string; target_channel_id: string; target_user_id: string; target_action: "mute" | "remove" }; Returns: string };
      create_community_invite: { Args: { target_community_id: string; target_max_uses?: number | null; target_expires_at?: string | null; target_campaign_label?: string | null }; Returns: Array<Database["public"]["Tables"]["community_invites"]["Row"]> };
      revoke_community_invite: { Args: { target_invite_id: string }; Returns: Array<Database["public"]["Tables"]["community_invites"]["Row"]> };
      list_community_invite_campaigns: { Args: { target_community_id: string }; Returns: Array<{ id: string; community_id: string; created_by: string; creator_name: string; campaign_label: string | null; max_uses: number | null; uses: number; expires_at: string | null; revoked_at: string | null; last_used_at: string | null; created_at: string }> };
      append_community_audit_log: {
        Args: { target_community_id: string; event_action_type: string; event_target_type: string; event_target_id: string | null; event_reason: string | null };
        Returns: string;
      };
      moderate_podcast_comment: { Args: { target_comment_id: string; moderation_reason: string }; Returns: boolean };
      moderate_podcast_episode: { Args: { target_episode_id: string; moderation_action: "unpublish" | "archive"; moderation_reason: string }; Returns: Array<Database["public"]["Tables"]["podcast_episodes"]["Row"]> };
      is_app_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      list_active_verification_badges:{Args:{target_subject_type:string;target_subject_id:string};Returns:Array<{id:string;subject_type:string;subject_id:string;badge_kind:string;label:string;scope_note:string;granted_at:string;revoked_at:null}>};
      list_recent_verification_badges:{Args:{result_limit?:number};Returns:Array<{id:string;subject_type:string;subject_id:string;badge_kind:string;label:string;scope_note:string;granted_at:string;revoked_at:string|null}>};
      grant_verification_badge:{Args:{target_subject_type:string;target_subject_id:string;target_badge_kind:string;target_label:string;target_scope_note:string;grant_reason:string};Returns:Array<{id:string;subject_type:string;subject_id:string;badge_kind:string;label:string;scope_note:string;granted_at:string;revoked_at:null}>};
      revoke_verification_badge:{Args:{target_badge_id:string;revoke_reason:string};Returns:boolean};
      get_own_profile_privacy:{Args:Record<string,never>;Returns:Array<{profile_visibility:"everyone"|"shared_communities"|"friends";show_location:boolean;show_timezone:boolean;show_activity:boolean;show_media:boolean}>};
      update_profile_privacy:{Args:{next_visibility:string;next_show_location:boolean;next_show_timezone:boolean;next_show_activity:boolean;next_show_media:boolean};Returns:boolean};
      get_profile_privacy_projection:{Args:{target_user_id:string};Returns:Array<{can_view_profile:boolean;show_location:boolean;show_timezone:boolean;show_activity:boolean;show_media:boolean;location:string|null;timezone:string|null}>};
      get_own_profile_privacy_v2:{Args:Record<string,never>;Returns:Array<{profile_visibility:"everyone"|"shared_communities"|"friends";show_online_status:boolean;show_location:boolean;show_timezone:boolean;show_activity:boolean;show_media:boolean}>};
      update_profile_privacy_v2:{Args:{next_visibility:string;next_show_online_status:boolean;next_show_location:boolean;next_show_timezone:boolean;next_show_activity:boolean;next_show_media:boolean};Returns:boolean};
      get_profile_privacy_projection_v2:{Args:{target_user_id:string};Returns:Array<{can_view_profile:boolean;show_online_status:boolean;show_location:boolean;show_timezone:boolean;show_activity:boolean;show_media:boolean;location:string|null;timezone:string|null}>};
      get_trust_safety_summary: {
        Args: Record<string, never>;
        Returns: Json;
      };
      begin_own_data_export: { Args: Record<string, never>; Returns: Array<{ id: string; requested_at: string }> };
      complete_own_data_export: { Args: { target_export_id: string; next_status: "ready" | "failed"; next_failure_code?: string | null }; Returns: Array<{ id: string; status: "ready" | "failed"; requested_at: string; completed_at: string; expires_at: string | null }> };
      register_current_device_session:{Args:{target_device_id:string;target_device_label:string;target_platform_label:string;target_runtime_label:string};Returns:string};
      list_current_user_device_sessions:{Args:Record<string,never>;Returns:Array<{id:string;device_label:string;platform_label:string;runtime_label:string;created_at:string;last_used_at:string;expires_at:string|null;revoked_at:string|null;current:boolean}>};
      revoke_other_device_sessions:{Args:Record<string,never>;Returns:number};
      get_admin_system_status_v2: { Args: Record<string, never>; Returns: Json };
      list_admin_operations_v2: { Args: { section_name: string; page_cursor_created_at?: string | null; page_cursor_id?: string | null; page_limit?: number }; Returns: Json };
      append_admin_operations_audit: { Args: { admin_action_type: string; admin_target_type: string; admin_target_id?: string | null }; Returns: number };
      can_manage_community_bots: { Args: { target_community_id: string }; Returns: boolean };
      issue_community_bot_credential: { Args: { target_community_id: string; target_bot_id: string }; Returns: Array<{ raw_token: string; token_prefix: string; created_at: string }> };
      revoke_community_bot_credential: { Args: { target_community_id: string; target_bot_id: string }; Returns: boolean };
      get_community_bot_credential_status: { Args: { target_community_id: string; target_bot_id: string }; Returns: Array<{ bot_id: string; token_prefix: string; created_at: string; revoked_at: string | null; rate_limit_per_minute: number }> };
      rotate_community_bot_credential: { Args: { target_community_id: string; target_bot_id: string }; Returns: Array<{ raw_token: string; token_prefix: string; created_at: string }> };
      create_channel_webhook: { Args: { target_community_id: string; target_channel_id: string; target_webhook_name: string; webhook_avatar_url: string | null }; Returns: Array<{ webhook_id: string; community_id: string; channel_id: string; webhook_name: string; avatar_url: string | null; created_by: string; revoked_at: string | null; created_at: string; updated_at: string; token_once: string }> };
      revoke_channel_webhook: { Args: { target_webhook_id: string }; Returns: Array<{ webhook_id: string; community_id: string; channel_id: string; webhook_name: string; avatar_url: string | null; created_by: string; revoked_at: string | null; created_at: string; updated_at: string }> };
      create_poll_atomic: { Args: { target_message_id: string; poll_question: string; option_texts: string[]; allow_multiple_choices: boolean; poll_closes_at: string | null }; Returns: Json };
      get_poll_state: { Args: { target_poll_id: string }; Returns: Json };
      toggle_poll_vote: { Args: { target_poll_id: string; target_option_id: string }; Returns: Json };
      close_poll: { Args: { target_poll_id: string }; Returns: Json };
      set_community_event_rsvp: { Args: { target_event_id: string; next_status: "interested" | "going" | "not_going" }; Returns: boolean };
      claim_radio_session_reminder_event: { Args: { target_reminder_id: string; event_key: string; event_starts_at: string; event_status: "draft" | "scheduled" | "live" | "ended" | "cancelled" }; Returns: boolean };
      open_or_create_thread: { Args: { target_community_id: string; target_channel_id: string; target_parent_message_id: string; thread_name: string }; Returns: Json };
      send_thread_message: { Args: { target_thread_id: string; message_body: string; target_client_message_id: string }; Returns: Json };
      get_thread_summary: { Args: { target_thread_id: string }; Returns: Json };
      mark_thread_read: { Args: { target_thread_id: string }; Returns: boolean };
      create_forum_post: { Args: { target_community_id: string; target_channel_id: string; post_title: string; post_body: string; post_tags: string[] }; Returns: Json };
      list_accessible_saved_messages: { Args: { result_limit?: number }; Returns: Array<{ id: string; message_id: string; community_id: string; channel_id: string; author_id: string; preview: string; message_created_at: string; created_at: string }> };
      get_community_insights_v2: { Args: { target_community_id: string; window_days?: number }; Returns: Json };
      get_profile_activity_v2: { Args: { target_user_id: string; result_limit?: number }; Returns: Json };
      get_profile_activity_v3: { Args: { target_user_id: string; result_limit?: number }; Returns: Json };
      get_own_profile_privacy_v3:{Args:Record<string,never>;Returns:Array<{profile_visibility:"everyone"|"shared_communities"|"friends";show_online_status:boolean;show_location:boolean;show_timezone:boolean;show_activity:boolean;show_media:boolean;show_communities:boolean;show_friends:boolean;show_follows:boolean;show_audio:boolean}>};
      update_profile_privacy_v3:{Args:{next_visibility:string;next_show_online_status:boolean;next_show_location:boolean;next_show_timezone:boolean;next_show_activity:boolean;next_show_media:boolean;next_show_communities:boolean;next_show_friends:boolean;next_show_follows:boolean;next_show_audio:boolean};Returns:boolean};
      get_profile_privacy_projection_v3:{Args:{target_user_id:string};Returns:Array<{profile_visibility:"everyone"|"shared_communities"|"friends";can_view_profile:boolean;show_online_status:boolean;show_location:boolean;show_timezone:boolean;show_activity:boolean;show_media:boolean;show_communities:boolean;show_friends:boolean;show_follows:boolean;show_audio:boolean;location:string|null;timezone:string|null}>};
      get_profile_domain_v1:{Args:{target_user_id:string;result_limit?:number};Returns:Json};
      update_own_profile_domain:{Args:{profile_patch:Json};Returns:Json};
      meeting_role_for_user:{Args:{target_room_id:string;target_user_id:string};Returns:"host"|"cohost"|"speaker"|"participant"|"viewer"|"guest"};
      can_view_meeting_room:{Args:{target_room_id:string};Returns:boolean};
      can_join_meeting_room:{Args:{target_room_id:string};Returns:boolean};
      meeting_join_disposition:{Args:{target_room_id:string};Returns:"direct"|"waiting"|"denied"};
      can_view_meeting_sensitive:{Args:{target_room_id:string};Returns:boolean};
      authorize_meeting_action:{Args:{target_room_id:string;target_action:string};Returns:Json};
      set_meeting_participant_role:{Args:{target_participant_id:string;next_role:string;change_reason:string};Returns:Json};
      list_community_meeting_rooms:{Args:{target_community_id:string};Returns:Json};
      create_community_meeting_room:{Args:{target_community_id:string;target_category_id:string|null;room_name:string;room_description:string;room_mode:"voice"|"meeting"|"stage";room_capabilities:Json;room_waiting_enabled:boolean;room_audience_mode:boolean;room_join_policy:string;room_participant_limit:number;room_chat_channel_id:string|null;room_moderation_policy:Json};Returns:Json};
      update_community_meeting_room:{Args:{target_room_id:string;room_name:string;room_description:string;room_mode:"voice"|"meeting"|"stage";room_capabilities:Json;room_waiting_enabled:boolean;room_audience_mode:boolean;room_join_policy:string;room_participant_limit:number;room_chat_channel_id:string|null;room_moderation_policy:Json};Returns:Json};
      archive_community_meeting_room:{Args:{target_room_id:string;confirmation_title:string;active_policy?:"deny"|"end"|"transfer";replacement_room_id?:string|null};Returns:boolean};
      move_community_meeting_room:{Args:{target_room_id:string;move_direction:"up"|"down"};Returns:boolean};
      schedule_meeting_room:{Args:{target_room_id:string;target_scheduled_for:string;target_scheduled_end_at:string;target_host_user_id?:string|null;target_cohost_user_ids?:string[];target_event_id?:string|null;target_reminder_policy?:Json};Returns:Json};
      create_meeting_invite:{Args:{target_room_id:string;target_token_hash:string;target_token_hint:string;target_role?:"host"|"cohost"|"speaker"|"participant"|"viewer"|"guest";target_invited_user_id?:string|null;target_session_id?:string|null;target_expires_at?:string|null;target_max_uses?:number};Returns:Json};
      regenerate_meeting_invite:{Args:{target_invite_id:string;target_token_hash:string;target_token_hint:string;target_role?:"host"|"cohost"|"speaker"|"participant"|"viewer"|"guest";target_invited_user_id?:string|null;target_session_id?:string|null;target_expires_at?:string|null;target_max_uses?:number};Returns:Json};
      revoke_meeting_invite:{Args:{target_invite_id:string};Returns:Json};
      validate_meeting_invite:{Args:{target_token_hash:string;target_room_id?:string|null;consume_use?:boolean};Returns:Json};
      get_meeting_join_preview:{Args:{target_room_id:string;target_token_hash?:string|null};Returns:Json};
      list_meeting_invites:{Args:{target_room_id:string};Returns:Json};
      authorize_livekit_meeting_token:{Args:{target_room_id:string;target_session_id:string;request_audio?:boolean;request_video?:boolean;request_screen?:boolean;request_data?:boolean};Returns:Array<{room_id:string;session_id:string;community_id:string;provider_room_name:string;participant_identity:string;participant_name:string;meeting_role:"host"|"cohost"|"speaker"|"participant"|"viewer"|"guest";access_state:"authorized"|"waiting";waiting_entry_id:string|null;can_subscribe:boolean;can_publish_audio:boolean;can_publish_video:boolean;can_publish_screen:boolean;can_publish_data:boolean}>};
      get_meeting_participant_snapshot:{Args:{target_room_id:string;target_session_id:string};Returns:Json};
      configure_meeting_chat_context:{Args:{target_room_id:string;target_context_kind:"linked_channel"|"dedicated_thread"|"meeting_source";target_channel_id?:string|null;target_thread_id?:string|null;target_preserve_after_meeting?:boolean;target_guest_access_expires_at?:string|null};Returns:Json};
      get_meeting_chat_context:{Args:{target_room_id:string;target_session_id?:string|null};Returns:Json};
      send_meeting_chat_message:{Args:{target_room_id:string;target_session_id:string|null;message_body:string;target_client_message_id:string;target_reply_to_message_id?:string|null;target_attachment_ids?:string[]};Returns:Array<Database["public"]["Tables"]["messages"]["Row"]>};
      mark_meeting_chat_read:{Args:{target_room_id:string;target_session_id:string|null;target_last_read_message_id?:string|null};Returns:boolean};
      set_meeting_participant_hand_state:{Args:{target_participant_id:string;target_raised:boolean};Returns:Json};
      update_meeting_hand_signal:{Args:{target_participant_id:string;target_action:"raise"|"lower"|"acknowledge"|"request_stage"|"cancel_stage"|"approve_stage"|"deny_stage"};Returns:Json};
      get_meeting_hand_queue:{Args:{target_room_id:string;target_session_id:string};Returns:Json};
      manage_meeting_stage_participant:{Args:{target_participant_id:string;stage_action:"promote"|"demote"|"remove";change_reason?:string};Returns:Json};
      control_meeting_session:{Args:{target_room_id:string;target_session_id:string;control_action:"lock"|"unlock"|"end"};Returns:Json};
      get_meeting_host_control_state:{Args:{target_room_id:string;target_session_id:string};Returns:Json};
      set_meeting_participant_cohost:{Args:{target_participant_id:string;target_enabled:boolean;change_reason:string};Returns:Json};
      transfer_meeting_host:{Args:{target_participant_id:string;change_reason:string};Returns:Json};
      set_meeting_participant_screen_share_policy:{Args:{target_participant_id:string;target_allowed:boolean;change_reason:string};Returns:Json};
      cancel_scheduled_meeting_room:{Args:{target_room_id:string;cancellation_reason:string};Returns:Json};
      enforce_my_meeting_media_policy:{Args:{target_room_id:string;target_session_id:string};Returns:Json};
      cleanup_stale_meeting_participants:{Args:{target_session_id:string;target_stale_before?:string};Returns:Json};
      process_livekit_webhook_event:{Args:{target_event_id:string;target_event_type:string;target_occurred_at:string;target_room_id:string;target_session_id:string;target_room_name:string;target_payload_digest:string;target_participant_identity?:string|null;target_participant_name?:string|null;target_track_sid?:string|null;target_track_kind?:string|null;target_track_source?:string|null};Returns:Json};
      expire_meeting_waiting_entries:{Args:{target_room_id?:string|null};Returns:number};
      request_meeting_waiting_admission:{Args:{target_room_id:string;target_session_id:string;target_request_message?:string;target_idempotency_key?:string|null};Returns:Json};
      resolve_meeting_waiting_entry:{Args:{target_entry_id:string;target_decision:"admit"|"deny";target_decision_note?:string|null};Returns:Json};
      resolve_all_meeting_waiting:{Args:{target_room_id:string;target_decision:"admit"|"deny";target_decision_note?:string|null};Returns:Json};
      cancel_meeting_waiting_request:{Args:{target_entry_id:string};Returns:Json};
      list_meeting_waiting_entries:{Args:{target_room_id:string};Returns:Json};
      get_my_meeting_waiting_entry:{Args:{target_room_id:string;target_session_id?:string|null};Returns:Json};
      dispatch_due_meeting_notifications:{Args:{target_limit?:number};Returns:number};
      enqueue_due_meeting_reminders:{Args:{target_now?:string;target_limit?:number};Returns:number};
      process_meeting_notification_jobs:{Args:{target_now?:string;target_limit?:number};Returns:Json};
      create_managed_text_channel: { Args: { target_community_id: string; target_category_id?: string | null; channel_name: string; channel_type?: "text" | "voice" | "forum" | "announcement"; channel_topic?: string | null; channel_is_private?: boolean; channel_public_read_enabled?: boolean }; Returns: Array<Database["public"]["Tables"]["channels"]["Row"]> };
      send_text_message_idempotent: { Args: { target_community_id: string; target_channel_id: string; message_body: string; target_client_message_id: string; target_reply_to_message_id?: string | null; target_attachment_ids?: string[] }; Returns: Array<Database["public"]["Tables"]["messages"]["Row"]> };
      complete_current_user_onboarding: { Args: { target_profile: Json; target_followed_user_ids?: string[]; target_theme?: "light" | "dark" | "system" }; Returns: Array<{ completed: boolean; completed_at: string; followed_user_ids: string[]; theme_mode: "light" | "dark" | "system" }> };
      follow_user: { Args: { target_user_id: string }; Returns: boolean };
      unfollow_user: { Args: { target_user_id: string }; Returns: boolean };
      set_message_reaction: { Args: { target_message_id: string; target_emoji: string; target_reacted: boolean }; Returns: Array<{ message_id: string; emoji: string; reaction_count: number; reacted_by_current_user: boolean }> };
      list_message_reaction_summaries: { Args: { target_message_ids: string[] }; Returns: Array<{ message_id: string; emoji: string; reaction_count: number; reacted_by_current_user: boolean }> };
      edit_message_with_version: { Args: { target_message_id: string; next_body: string; expected_edited_at: string | null }; Returns: Array<{ id: string; body: string; edited_at: string; deleted_at: string | null }> };
      delete_message_with_version: { Args: { target_message_id: string; expected_edited_at: string | null }; Returns: Array<{ id: string; deleted_at: string }> };
      mark_channel_read: { Args: { target_channel_id: string; target_last_read_message_id: string | null }; Returns: boolean };
      get_my_community_unread_state: {
        Args: { target_community_id: string };
        Returns: Array<{ channel_id: string; unread_count: number; mention_count: number; last_message_id: string | null; last_read_message_id: string | null }>;
      };
      list_mention_feed: {
        Args: { cursor_created_at?: string | null; cursor_message_id?: string | null; result_limit?: number };
        Returns: Array<Database["public"]["Views"]["mention_feed_view"]["Row"]>;
      };
      list_unified_content_mentions: {
        Args: { cursor_created_at?: string | null; cursor_mention_id?: string | null; source_types?: string[] | null; community_filter?: string | null; result_limit?: number };
        Returns: Array<Pick<Database["public"]["Tables"]["content_mentions"]["Row"], "id" | "source_type" | "source_id" | "parent_source_id" | "community_id" | "channel_id" | "author_id" | "mentioned_user_id" | "preview" | "source_created_at" | "source_updated_at" | "visibility_context">>;
      };
      list_ranked_unified_feed: {
        Args: { feed_mode?: "popular" | "following"; ranking_epoch_input?: string; cursor_rank?: number | null; cursor_created_at?: string | null; cursor_feed_item_id?: string | null; source_types?: string[] | null; created_after?: string | null; unread_only?: boolean; saved_only?: boolean; result_limit?: number };
        Returns: Array<Database["public"]["Views"]["unified_content_feed_view"]["Row"] & { reaction_count: number; comment_count: number; listener_count: number; is_unread: boolean; is_saved: boolean; is_follow_related: boolean; ranking_score: number; ranking_epoch: string }>;
      };
      list_followed_user_stories: {
        Args: { cursor_created_at?: string | null; cursor_story_id?: string | null; result_limit?: number };
        Returns: Array<Database["public"]["Views"]["followed_user_stories_view"]["Row"]>;
      };
      list_followed_content_stories: { Args: { cursor_created_at?: string | null; cursor_story_id?: string | null; result_limit?: number }; Returns: Array<Database["public"]["Views"]["followed_content_stories_view"]["Row"]> };
      get_direct_message_privacy: { Args: Record<string, never>; Returns: "everyone" | "friends" | "no_one" };
      update_direct_message_privacy: { Args: { next_privacy: "everyone" | "friends" | "no_one" }; Returns: boolean };
      submit_safety_report: {
        Args: { report_target_type: string; report_target_id: string; report_reason: string; report_description?: string | null; report_community_id?: string | null; report_conversation_id?: string | null };
        Returns: Array<Database["public"]["Tables"]["reports"]["Row"]>;
      };
    };
    Enums: {
      community_kind: "text" | "radio" | "podcast";
    };
    CompositeTypes: Record<string, never>;
  };
};
