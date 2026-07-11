import type { ReportRecord, ReportStatus } from "../../types/reports";
import { reportService } from "../reportService";
import { podcastService } from "./podcastService";

const isPodcastReport = (report: ReportRecord): boolean => report.targetType === "podcast_episode" || report.targetType === "podcast_comment";

export const podcastModerationService = {
  async listReports(communityId: string, permissions: Readonly<{ canModerateComments: boolean; canModerateEpisodes: boolean }>) {
    const canModerate = permissions.canModerateComments || permissions.canModerateEpisodes;
    const result = await reportService.listCommunityReports(communityId, canModerate);
    return result.ok ? { ok: true as const, data: result.data.filter((report) => isPodcastReport(report) && (report.targetType === "podcast_comment" ? permissions.canModerateComments || permissions.canModerateEpisodes : permissions.canModerateEpisodes)) } : result;
  },
  updateReportStatus: (reportId: string, status: ReportStatus, canModerate: boolean) => reportService.updateReportStatus({ reportId, status, canReview: canModerate }),
  moderateComment: (commentId: string, reason: string) => podcastService.moderatePodcastComment(commentId, reason),
  moderateEpisode: (episodeId: string, action: "unpublish" | "archive", reason: string) => podcastService.moderatePodcastEpisode(episodeId, action, reason),
};
