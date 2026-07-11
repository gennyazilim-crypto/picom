import type { DataSourceMode } from "./appConfig";

export type DataSourceDecision = Readonly<{
  mode: DataSourceMode;
  explicit: boolean;
  reason?: string;
}>;

export function resolveDataSourceDecision(value: string | undefined = import.meta.env.VITE_DATA_SOURCE): DataSourceDecision {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "mock" || normalized === "supabase") return { mode: normalized, explicit: true };
  return { mode: "supabase", explicit: false, reason: "VITE_DATA_SOURCE must explicitly be mock or supabase. Fake data fallback is disabled." };
}

export function selectMockFixture<T>(fixture: T, productionValue: T): T {
  const decision = resolveDataSourceDecision();
  return decision.explicit && decision.mode === "mock" ? fixture : productionValue;
}
