import { appConfig } from "../config/appConfig";
import { externalLinkService, type ExternalLinkResult } from "./externalLinkService";

export type StatusPageOpenResult =
  | ExternalLinkResult
  | { ok: false; reason: "STATUS_PAGE_URL_NOT_CONFIGURED" };

export const statusPageService = {
  getUrl(): string {
    return appConfig.statusPageUrl;
  },

  isConfigured(): boolean {
    return Boolean(appConfig.statusPageUrl.trim());
  },

  getDisplayDomain(): string {
    return appConfig.statusPageUrl ? externalLinkService.getDisplayDomain(appConfig.statusPageUrl) : "Not configured";
  },

  async openStatusPage(): Promise<StatusPageOpenResult> {
    if (!this.isConfigured()) {
      return { ok: false, reason: "STATUS_PAGE_URL_NOT_CONFIGURED" };
    }

    return externalLinkService.openExternalUrl(appConfig.statusPageUrl);
  },
};
