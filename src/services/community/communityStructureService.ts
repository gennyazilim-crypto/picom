import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import type { CommunityPermissionKey, CommunityPermissionOverrideEffect } from "../../types/communityAccess";
import type {
  AudioCommunityKind,
  CommunityStructureResult,
  CommunityStructureSection,
  CommunityStructureSectionType,
  CommunityStructureVisibility,
  ManagedCategorySummary,
  ManagedPermissionOverride,
} from "../../types/communityStructure";

type RpcError = Readonly<{ message: string }>;
type RpcClient = Readonly<{ rpc: (name: string, args?: Record<string, unknown>) => Promise<Readonly<{ data: unknown; error: RpcError | null }>> }>;
type SectionRow = Readonly<{ id: string; community_id: string; community_kind: AudioCommunityKind; section_type: CommunityStructureSectionType; label: string; position: number; visibility: CommunityStructureVisibility; is_enabled: boolean; is_required: boolean; created_at: string; updated_at: string }>;
type OverrideRow = Readonly<{ role_id: string; permission_key: CommunityPermissionKey; effect: CommunityPermissionOverrideEffect }>;

const sectionTemplates: Readonly<Record<AudioCommunityKind, readonly Readonly<{ type: CommunityStructureSectionType; label: string; visibility: CommunityStructureVisibility; required: boolean }>[]>> = {
  radio: [
    { type: "radio_programs", label: "Programs", visibility: "public", required: true },
    { type: "radio_schedule", label: "Schedule", visibility: "public", required: true },
    { type: "radio_hosts", label: "Hosts", visibility: "members", required: false },
    { type: "radio_listener_chat", label: "Listener chat", visibility: "members", required: false },
  ],
  podcast: [
    { type: "podcast_series", label: "Series", visibility: "public", required: true },
    { type: "podcast_episodes", label: "Episodes", visibility: "public", required: true },
    { type: "podcast_drafts", label: "Drafts", visibility: "managers", required: false },
    { type: "podcast_publishers", label: "Publishers", visibility: "members", required: false },
    { type: "podcast_listener_discussion", label: "Listener discussion", visibility: "members", required: false },
  ],
};

const mockSections = new Map<string, CommunityStructureSection[]>();
const mockOverrides = new Map<string, ManagedPermissionOverride[]>();

function fail<T>(error: string): CommunityStructureResult<T> { return { ok: false, error }; }
function ok<T>(data: T): CommunityStructureResult<T> { return { ok: true, data }; }
function firstRow(data: unknown): Record<string, unknown> | null { const row = Array.isArray(data) ? data[0] : data; return row && typeof row === "object" ? row as Record<string, unknown> : null; }
function mapSection(row: SectionRow): CommunityStructureSection { return { id: row.id, communityId: row.community_id, communityKind: row.community_kind, sectionType: row.section_type, label: row.label, position: row.position, visibility: row.visibility, isEnabled: row.is_enabled, isRequired: row.is_required, createdAt: row.created_at, updatedAt: row.updated_at }; }
function newId(prefix: string): string { return typeof crypto !== "undefined" && "randomUUID" in crypto ? `${prefix}-${crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function storageKey(communityId: string): string { return `picom.community-structure.v1.${communityId}`; }

function persistMock(communityId: string, sections: readonly CommunityStructureSection[]): void {
  mockSections.set(communityId, [...sections]);
  try { globalThis.localStorage?.setItem(storageKey(communityId), JSON.stringify(sections)); } catch { /* Local persistence is optional in restricted runtimes. */ }
}

function defaultSections(communityId: string, kind: AudioCommunityKind): CommunityStructureSection[] {
  const now = new Date().toISOString();
  return sectionTemplates[kind].map((template, position) => ({ id: `mock-section-${communityId}-${template.type}`, communityId, communityKind: kind, sectionType: template.type, label: template.label, position, visibility: template.visibility, isEnabled: true, isRequired: template.required, createdAt: now, updatedAt: now }));
}

function readMock(communityId: string, kind: AudioCommunityKind): CommunityStructureSection[] {
  const cached = mockSections.get(communityId); if (cached) return [...cached];
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(storageKey(communityId)) ?? "null") as unknown;
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((item): item is CommunityStructureSection => Boolean(item && typeof item === "object" && (item as CommunityStructureSection).communityKind === kind));
      if (valid.length) { mockSections.set(communityId, valid); return [...valid].sort((left, right) => left.position - right.position); }
    }
  } catch { /* Rebuild safe defaults when local state is corrupt. */ }
  const defaults = defaultSections(communityId, kind); persistMock(communityId, defaults); return defaults;
}

async function callRpc(name: string, args: Record<string, unknown> = {}): Promise<CommunityStructureResult<unknown>> {
  const client = getSupabaseClient(); if (!client) return fail("Community structure storage is unavailable.");
  const result = await (client as unknown as RpcClient).rpc(name, args);
  return result.error ? fail(result.error.message) : ok(result.data);
}

function mockMove<T extends { position: number }>(items: readonly T[], id: string, direction: "up" | "down", getId: (item: T) => string): T[] {
  const ordered = [...items].sort((left, right) => left.position - right.position);
  const index = ordered.findIndex((item) => getId(item) === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  const [item] = ordered.splice(index, 1); ordered.splice(target, 0, item);
  return ordered.map((entry, position) => ({ ...entry, position }));
}

export const communityStructureService = {
  sectionTemplates,

  async listSections(communityId: string, kind: AudioCommunityKind): Promise<CommunityStructureResult<CommunityStructureSection[]>> {
    if (dataSourceService.getStatus().isMock) return ok(readMock(communityId, kind));
    const result = await callRpc("list_community_structure_sections", { target_community_id: communityId });
    if (!result.ok) return result;
    return ok((Array.isArray(result.data) ? result.data : []).map((row) => mapSection(row as SectionRow)).filter((section) => section.communityKind === kind));
  },

  async updateSection(section: CommunityStructureSection, changes: Readonly<{ label: string; visibility: CommunityStructureVisibility; isEnabled: boolean }>): Promise<CommunityStructureResult<CommunityStructureSection>> {
    if (section.isRequired && !changes.isEnabled) return fail("Required sections cannot be disabled without a recovery path.");
    if (dataSourceService.getStatus().isMock) {
      const sections = readMock(section.communityId, section.communityKind).map((item) => item.id === section.id ? { ...item, label: changes.label.trim(), visibility: changes.visibility, isEnabled: changes.isEnabled, updatedAt: new Date().toISOString() } : item);
      persistMock(section.communityId, sections); return ok(sections.find((item) => item.id === section.id)!);
    }
    const result = await callRpc("update_community_structure_section", { target_section_id: section.id, next_label: changes.label, next_visibility: changes.visibility, next_enabled: changes.isEnabled });
    if (!result.ok) return result;
    const row = firstRow(result.data); return row ? ok(mapSection(row as unknown as SectionRow)) : fail("The section was not returned after update.");
  },

  async moveSection(section: CommunityStructureSection, direction: "up" | "down"): Promise<CommunityStructureResult<CommunityStructureSection[]>> {
    if (dataSourceService.getStatus().isMock) { const moved = mockMove(readMock(section.communityId, section.communityKind), section.id, direction, (item) => item.id); persistMock(section.communityId, moved); return ok(moved); }
    const result = await callRpc("move_community_structure_section", { target_section_id: section.id, move_direction: direction });
    if (!result.ok) return result;
    return this.listSections(section.communityId, section.communityKind);
  },

  async deleteSection(section: CommunityStructureSection): Promise<CommunityStructureResult<string>> {
    if (section.isRequired) return fail("Required sections cannot be deleted. Keep the recovery route available.");
    if (dataSourceService.getStatus().isMock) { persistMock(section.communityId, readMock(section.communityId, section.communityKind).filter((item) => item.id !== section.id).map((item, position) => ({ ...item, position }))); return ok(section.id); }
    const result = await callRpc("delete_community_structure_section", { target_section_id: section.id });
    return result.ok ? ok(section.id) : result;
  },

  async restoreDefaultSections(communityId: string, kind: AudioCommunityKind): Promise<CommunityStructureResult<CommunityStructureSection[]>> {
    if (dataSourceService.getStatus().isMock) {
      const current = readMock(communityId, kind); const present = new Set(current.map((item) => item.sectionType));
      const restored = [...current, ...defaultSections(communityId, kind).filter((item) => !present.has(item.sectionType))].map((item, position) => ({ ...item, position }));
      persistMock(communityId, restored); return ok(restored);
    }
    const result = await callRpc("restore_community_structure_defaults", { target_community_id: communityId });
    return result.ok ? this.listSections(communityId, kind) : result;
  },

  async createTextCategory(communityId: string, name: string): Promise<CommunityStructureResult<ManagedCategorySummary>> {
    const clean = name.trim().slice(0, 80); if (!clean) return fail("Category name is required.");
    if (dataSourceService.getStatus().isMock) return ok({ id: newId("local-category"), name: clean, position: 999 });
    const result = await callRpc("create_managed_category", { target_community_id: communityId, category_name: clean }); if (!result.ok) return result;
    const row = firstRow(result.data); return row ? ok({ id: String(row.id), name: String(row.name), position: Number(row.position) }) : fail("The category was not returned after creation.");
  },

  async renameTextCategory(communityId: string, categoryId: string, name: string): Promise<CommunityStructureResult<boolean>> {
    if (dataSourceService.getStatus().isMock) return name.trim() ? ok(true) : fail("Category name is required.");
    const result = await callRpc("rename_managed_category", { target_category_id: categoryId, category_name: name.trim(), expected_community_id: communityId }); return result.ok ? ok(true) : result;
  },

  async deleteTextCategory(communityId: string, categoryId: string): Promise<CommunityStructureResult<boolean>> {
    if (dataSourceService.getStatus().isMock) return ok(true);
    const result = await callRpc("delete_managed_category", { target_category_id: categoryId, expected_community_id: communityId }); return result.ok ? ok(true) : result;
  },

  async moveTextCategory(communityId: string, categoryId: string, direction: "up" | "down"): Promise<CommunityStructureResult<boolean>> {
    if (dataSourceService.getStatus().isMock) return ok(true);
    const result = await callRpc("move_managed_category", { target_category_id: categoryId, expected_community_id: communityId, move_direction: direction }); return result.ok ? ok(true) : result;
  },

  async moveTextChannel(communityId: string, categoryId: string, channelId: string, direction: "up" | "down"): Promise<CommunityStructureResult<boolean>> {
    if (dataSourceService.getStatus().isMock) return ok(true);
    const result = await callRpc("move_managed_channel", { target_channel_id: channelId, expected_community_id: communityId, expected_category_id: categoryId, move_direction: direction }); return result.ok ? ok(true) : result;
  },

  async listChannelOverrides(communityId: string, channelId: string): Promise<CommunityStructureResult<ManagedPermissionOverride[]>> {
    const key = `${communityId}:${channelId}`;
    if (dataSourceService.getStatus().isMock) return ok([...(mockOverrides.get(key) ?? [])]);
    const result = await callRpc("list_community_permission_overrides_for_scope", { target_community_id: communityId, target_scope_type: "channel", target_scope_id: channelId });
    if (!result.ok) return result;
    return ok((Array.isArray(result.data) ? result.data : []).map((row) => row as OverrideRow).map((row) => ({ roleId: row.role_id, permission: row.permission_key, effect: row.effect })));
  },

  async setChannelOverride(input: Readonly<{ communityId: string; channelId: string; roleId: string; permission: CommunityPermissionKey; effect: CommunityPermissionOverrideEffect | "inherit" }>): Promise<CommunityStructureResult<boolean>> {
    const key = `${input.communityId}:${input.channelId}`;
    if (dataSourceService.getStatus().isMock) {
      const remaining = (mockOverrides.get(key) ?? []).filter((item) => !(item.roleId === input.roleId && item.permission === input.permission));
      if (input.effect !== "inherit") remaining.push({ roleId: input.roleId, permission: input.permission, effect: input.effect });
      mockOverrides.set(key, remaining); return ok(true);
    }
    const result = await callRpc("set_community_permission_override", { target_community_id: input.communityId, target_role_id: input.roleId, target_scope_type: "channel", target_scope_id: input.channelId, target_permission: input.permission, target_effect: input.effect, change_reason: "Updated channel access override from community management." });
    return result.ok ? ok(true) : result;
  },
};
