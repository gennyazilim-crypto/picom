import { screenCaptureService, type ScreenCaptureServiceResult, type ScreenCaptureSource } from "../screenCaptureService";

export type ScreenShareSource = ScreenCaptureSource;
export type ScreenShareSourceResult = ScreenCaptureServiceResult;

export const screenShareService = {
  async listSources(): Promise<ScreenShareSourceResult> {
    return screenCaptureService.listSources();
  },

  isValidSourceId(sourceId: string): boolean {
    return /^(screen|window):/.test(sourceId);
  },
};
