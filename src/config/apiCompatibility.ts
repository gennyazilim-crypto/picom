import { appConfig } from "./appConfig";

export const PICOM_API_VERSION = "1";

export function getApiCompatibilityRequestHeaders(): Record<string, string> {
  return {
    "X-Picom-API-Version": PICOM_API_VERSION,
    "X-Picom-Client-Version": appConfig.version,
  };
}
