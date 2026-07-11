import type { Community } from "../../types/community";
import type { RadioAnnouncement, RadioCommunitySettings, RadioCommunityShellSnapshot, RadioProgram, RadioProgramSchedule } from "../../types/audio";
import { mockRadioAnnouncements, mockRadioPrograms, mockRadioProgramSchedules } from "../../data/mockAudio";
import { dataSourceService } from "../dataSourceService";
import type { Database } from "../supabase/database.types";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { radioService } from "./radioService";

type SettingsRow = Database["public"]["Tables"]["radio_community_settings"]["Row"];
type ProgramRow = Database["public"]["Tables"]["radio_programs"]["Row"];
type ScheduleRow = Database["public"]["Tables"]["radio_program_schedules"]["Row"];
type ProgramHostRow = Database["public"]["Tables"]["radio_program_hosts"]["Row"];
type AnnouncementRow = Database["public"]["Tables"]["radio_announcements"]["Row"];
export type RadioCommunityResult = Readonly<{ ok: true; data: RadioCommunityShellSnapshot }> | Readonly<{ ok: false; error: string }>;

function settingsFromRow(communityId: string, row?: SettingsRow | null): RadioCommunitySettings {
  return {
    communityId,
    scheduleTimezone: row?.schedule_timezone || "UTC",
    listenerChatEnabled: row?.listener_chat_enabled === true && Boolean(row.listener_chat_channel_id),
    listenerChatChannelId: row?.listener_chat_channel_id ?? undefined,
    announcementsEnabled: row?.announcements_enabled ?? true,
  };
}

function programFromRow(row: ProgramRow, hostUserIds: readonly string[]): RadioProgram {
  return { id: row.id, communityId: row.community_id, title: row.title, description: row.description, hostUserId: row.host_user_id ?? hostUserIds[0], hostUserIds, slug: row.slug ?? undefined, coverUrl: row.cover_url ?? undefined, coverStoragePath: row.cover_storage_path ?? undefined, tags: row.tags, defaultDurationMinutes: row.default_duration_minutes, isActive: row.is_active, createdAt: row.created_at };
}

function scheduleFromRow(row: ScheduleRow): RadioProgramSchedule {
  return { id: row.id, programId: row.program_id, communityId: row.community_id, weekday: row.weekday, startsAtLocal: row.starts_at_local, durationMinutes: row.duration_minutes, timezone: row.timezone, effectiveFrom: row.effective_from, effectiveUntil: row.effective_until ?? undefined, isActive: row.is_active };
}

function announcementFromRow(row: AnnouncementRow): RadioAnnouncement {
  return { id: row.id, communityId: row.community_id, authorUserId: row.author_id, body: row.body, publishedAt: row.published_at };
}

function getHostUserIds(community: Community, assignedUserIds: readonly string[] = []): string[] {
  const hostRoleIds = new Set(community.roles.filter((role) => role.name === "Owner" || role.name === "Radio Host" || role.capabilities?.includes("hostRadio")).map((role) => role.id));
  return [...new Set([...community.members.filter((member) => hostRoleIds.has(member.roleId)).map((member) => member.userId), ...assignedUserIds])];
}

export const radioCommunityService = {
  async getShellSnapshot(community: Community): Promise<RadioCommunityResult> {
    if (community.kind !== "radio") return { ok: false, error: "This workspace is not a Radio community." };
    const sessions = await radioService.getCommunityRadioSessions(community.id);
    if (!sessions.ok) return { ok: false, error: sessions.error.message };

    if (dataSourceService.getStatus().isMock) {
      const programs = mockRadioPrograms.filter((program) => program.communityId === community.id);
      return { ok: true, data: { settings: settingsFromRow(community.id), sessions: sessions.data, programs, schedules: mockRadioProgramSchedules.filter((schedule) => schedule.communityId === community.id), announcements: mockRadioAnnouncements.filter((announcement) => announcement.communityId === community.id), hostUserIds: getHostUserIds(community, programs.flatMap((program) => program.hostUserIds ?? [])) } };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Radio station data is unavailable while Supabase is not configured." };
    const [settings, programs, schedules, programHosts, announcements] = await Promise.all([
      client.from("radio_community_settings").select("community_id,schedule_timezone,listener_chat_enabled,listener_chat_channel_id,announcements_enabled,created_at,updated_at").eq("community_id", community.id).maybeSingle(),
      client.from("radio_programs").select("id,community_id,title,description,host_user_id,created_by,slug,cover_url,cover_storage_path,tags,default_duration_minutes,is_active,created_at,updated_at").eq("community_id", community.id).eq("is_active", true).order("created_at", { ascending: true }).limit(100),
      client.from("radio_program_schedules").select("id,program_id,community_id,weekday,starts_at_local,duration_minutes,timezone,effective_from,effective_until,is_active,created_by,created_at,updated_at").eq("community_id", community.id).eq("is_active", true).order("weekday", { ascending: true }).limit(200),
      client.from("radio_program_hosts").select("id,program_id,user_id,host_role,assigned_by,assigned_at").limit(500),
      client.from("radio_announcements").select("id,community_id,author_id,body,published_at,created_at").eq("community_id", community.id).order("published_at", { ascending: false }).limit(50),
    ]);
    if (settings.error || programs.error || schedules.error || programHosts.error || announcements.error) return { ok: false, error: "Picom could not load the Radio station structure." };
    const hostRows = (programHosts.data ?? []) as ProgramHostRow[];
    const visibleProgramIds = new Set((programs.data ?? []).map((program) => program.id));
    const assignedHostIds = hostRows.filter((host) => visibleProgramIds.has(host.program_id)).map((host) => host.user_id);
    return {
      ok: true,
      data: {
        settings: settingsFromRow(community.id, settings.data),
        sessions: sessions.data,
        programs: (programs.data ?? []).map((program) => programFromRow(program, hostRows.filter((host) => host.program_id === program.id).map((host) => host.user_id))),
        schedules: (schedules.data ?? []).map(scheduleFromRow),
        announcements: (announcements.data ?? []).map(announcementFromRow),
        hostUserIds: getHostUserIds(community, assignedHostIds),
      },
    };
  },
};
