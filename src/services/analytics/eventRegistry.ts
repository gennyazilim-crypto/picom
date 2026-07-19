// Task 051 — governed, versioned event taxonomy registry.
//
// This is the single source of truth for Picom's canonical analytics events: their
// owners, lifecycle status, version, and — critically — a PII classification for every
// property. `event-registry.json` holds the data so both the app and the CI validator
// (`scripts/intelligence-event-taxonomy-validate.mjs`) read exactly the same taxonomy.
//
// Governance rules enforced in CI:
//   1. Event and property names are canonical snake_case.
//   2. Every active event mirrors `eventSchema.ts` ALLOWED_METADATA exactly (no drift).
//   3. Every property is PII-classified; none may be `forbidden` or collide with the
//      SENSITIVE blocklist (this is what caught the `releaseChannel`/`channel` bug).
//   4. Every event has a known owner, status, and `since` version.
//   5. Every legacy event maps to a canonical replacement or a proposed canonical name.
//
// See docs/intelligence/platform/registry/EVENT_TAXONOMY_GOVERNANCE.md.

import registry from "./event-registry.json";
import type { AnalyticsEventName } from "./eventSchema";

export type PiiClass = "none" | "pseudonymous" | "forbidden";
export type EventStatus = "active" | "deprecated" | "proposed";
export type EventDomain =
  | "lifecycle"
  | "navigation"
  | "acquisition"
  | "engagement"
  | "auth"
  | "media"
  | "voice"
  | "search";

export type PropertySpec = Readonly<{
  type: "string" | "number" | "boolean";
  required: boolean;
  pii: PiiClass;
  note?: string;
}>;

export type CanonicalEvent = Readonly<{
  name: string;
  domain: EventDomain;
  owner: string;
  status: EventStatus;
  since: number;
  deprecatedIn?: number;
  replacedBy?: string;
  description: string;
  properties: Readonly<Record<string, PropertySpec>>;
}>;

export type LegacyMapping = Readonly<{
  legacy: string;
  source: string;
  replacedBy: string | null;
  status: "deprecated" | "proposed-canonical";
  proposedName?: string;
  note?: string;
}>;

const REGISTRY = registry as unknown as {
  registryVersion: number;
  schemaVersion: number;
  namePattern: string;
  owners: readonly string[];
  piiClasses: readonly PiiClass[];
  events: readonly CanonicalEvent[];
  legacyMap: readonly LegacyMapping[];
};

export const EVENT_NAME_PATTERN = new RegExp(REGISTRY.namePattern);
export const KNOWN_OWNERS: readonly string[] = REGISTRY.owners;
export const CANONICAL_EVENTS: readonly CanonicalEvent[] = REGISTRY.events;
export const LEGACY_EVENT_MAP: readonly LegacyMapping[] = REGISTRY.legacyMap;

/** True when a name follows the canonical snake_case convention. */
export function isCanonicalEventName(name: string): boolean {
  return EVENT_NAME_PATTERN.test(name);
}

/** Active (currently collectable) canonical events. */
export function listActiveEvents(): readonly CanonicalEvent[] {
  return CANONICAL_EVENTS.filter((event) => event.status === "active");
}

/** Look up a canonical event definition by name. */
export function getEventDefinition(name: string): CanonicalEvent | undefined {
  return CANONICAL_EVENTS.find((event) => event.name === name);
}

/** Resolve a (possibly legacy) event name to its canonical replacement, if any. */
export function resolveCanonicalName(name: string): string | null {
  if (getEventDefinition(name)) return name;
  const mapping = LEGACY_EVENT_MAP.find((entry) => entry.legacy === name);
  return mapping?.replacedBy ?? mapping?.proposedName ?? null;
}

/** The owning team for an event, or null for unknown events. */
export function getEventOwner(name: AnalyticsEventName | string): string | null {
  return getEventDefinition(name)?.owner ?? null;
}
