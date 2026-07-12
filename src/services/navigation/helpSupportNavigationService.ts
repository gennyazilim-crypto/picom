export const HELP_SUPPORT_SECTION_IDS = ["getting-started", "install-update", "feed", "communities", "direct-messages", "voice-screen-share", "radio", "podcasts", "troubleshooting", "export-diagnostics", "report-problem"] as const;
export type HelpSupportSectionId = (typeof HELP_SUPPORT_SECTION_IDS)[number];
export type HelpSupportEntrySource = "global-sidebar" | "sanctioned-error-cta";

let pendingRequest: Readonly<{ source: HelpSupportEntrySource; sectionId: HelpSupportSectionId }> | null = null;
const normalize = (sectionId: string | null | undefined): HelpSupportSectionId => HELP_SUPPORT_SECTION_IDS.includes(sectionId as HelpSupportSectionId) ? sectionId as HelpSupportSectionId : "getting-started";

export const helpSupportNavigationService = {
  request(source: HelpSupportEntrySource, sectionId?: string | null) {
    pendingRequest = { source, sectionId: normalize(sectionId) };
    return pendingRequest;
  },
  consume() {
    const request = pendingRequest ?? { source: "global-sidebar" as const, sectionId: "getting-started" as const };
    pendingRequest = null;
    return request;
  },
};
