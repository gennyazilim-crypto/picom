import { appConfig } from "../config/appConfig";
import { dataSourceService } from "./dataSourceService";

export type ProductionConfigurationIssueCode =
  | "DATA_SOURCE_NOT_EXPLICIT"
  | "PRODUCTION_MOCK_FORBIDDEN"
  | "SUPABASE_CONFIGURATION_INVALID";

export type ProductionConfigurationIssue = Readonly<{
  code: ProductionConfigurationIssueCode;
  message: string;
}>;

export type ProductionRuntimeConfiguration = Readonly<{
  ready: boolean;
  dataSource: "mock" | "supabase";
  environment: string;
  releaseChannel: string;
  issues: readonly ProductionConfigurationIssue[];
}>;

function getConfiguration(): ProductionRuntimeConfiguration {
  const status = dataSourceService.getStatus();
  const protectedRelease = appConfig.environment === "production" || appConfig.releaseChannel === "stable";
  const issues: ProductionConfigurationIssue[] = [];

  if (!status.explicit) {
    issues.push({
      code: "DATA_SOURCE_NOT_EXPLICIT",
      message: "Select an explicit Picom data source before startup. Development may use mock; V1 production requires Supabase.",
    });
  }

  if (protectedRelease && !status.isSupabase) {
    issues.push({
      code: "PRODUCTION_MOCK_FORBIDDEN",
      message: "Picom V1 stable cannot start with mock data. Configure the approved Supabase production project.",
    });
  }

  if (status.isSupabase && !status.configured) {
    issues.push({
      code: "SUPABASE_CONFIGURATION_INVALID",
      message: status.reason ?? "Supabase public renderer configuration is missing or invalid.",
    });
  }

  return Object.freeze({
    ready: issues.length === 0,
    dataSource: status.mode,
    environment: appConfig.environment,
    releaseChannel: appConfig.releaseChannel,
    issues: Object.freeze(issues),
  });
}

export const productionRuntimeConfigService = Object.freeze({ getConfiguration });
