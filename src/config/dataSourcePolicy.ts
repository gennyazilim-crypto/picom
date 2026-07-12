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

function isProductionRuntime(context: DataSourceRuntimeContext): boolean {
  return context.environment?.trim().toLowerCase() === "production"
    || context.releaseChannel?.trim().toLowerCase() === "stable";
}

export function resolveDataSourceDecision(
  value: string | undefined = import.meta.env.VITE_DATA_SOURCE,
  context: DataSourceRuntimeContext = defaultRuntimeContext(),
): DataSourceDecision {
  const normalized = value?.trim().toLowerCase();

  if (isProductionRuntime(context)) {
    if (normalized === "supabase") return { mode: "supabase", explicit: true };
    if (normalized === "mock") {
      return {
        mode: "mock",
        explicit: true,
        reason: "Picom V1 stable and production builds require VITE_DATA_SOURCE=supabase. Mock fallback is disabled.",
      };
    }
    return {
      mode: "supabase",
      explicit: false,
      reason: "Picom V1 stable and production builds require VITE_DATA_SOURCE=supabase. Mock fallback is disabled.",
    };
  }

  if (normalized === "mock" || normalized === "supabase") return { mode: normalized, explicit: true };
  return { mode: "supabase", explicit: false, reason: "VITE_DATA_SOURCE must explicitly be mock or supabase. Fake data fallback is disabled." };
}

export function selectMockFixture<T>(fixture: T, productionValue: T): T {
  const decision = resolveDataSourceDecision();
  return decision.explicit && decision.mode === "mock" && !decision.reason ? fixture : productionValue;
}
