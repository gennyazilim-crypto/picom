export type DataSourceMode = "mock" | "supabase";

export type DataSourceRuntimeContext = Readonly<{
  environment?: string;
  releaseChannel?: string;
}>;

export type DataSourceDecision = Readonly<{
  mode: DataSourceMode;
  explicit: boolean;
  reason?: string;
}>;

function defaultRuntimeContext(): DataSourceRuntimeContext {
  return {
    environment: import.meta.env.VITE_APP_ENV,
    releaseChannel: import.meta.env.VITE_RELEASE_CHANNEL,
  };
}

export function resolveDataSourceDecision(
  value: string | undefined = import.meta.env.VITE_DATA_SOURCE,
  _context: DataSourceRuntimeContext = defaultRuntimeContext(),
): DataSourceDecision {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "supabase") return { mode: "supabase", explicit: true };
  if (normalized === "mock") {
    return {
      mode: "supabase",
      explicit: false,
      reason: "Mock data source is disabled. Set VITE_DATA_SOURCE=supabase.",
    };
  }
  return { mode: "supabase", explicit: false, reason: "VITE_DATA_SOURCE must explicitly be supabase. Mock fallback is disabled." };
}

export function selectMockFixture<T>(_fixture: T, productionValue: T): T {
  return productionValue;
}
