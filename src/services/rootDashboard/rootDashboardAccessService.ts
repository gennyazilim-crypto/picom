import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { adminOperationsService, type AdminOperationsAccess } from "../adminOperationsService";

export type RootDashboardAccessStatus = "loading" | "allowed" | "denied";

export type RootDashboardAccessState = Readonly<{
  status: RootDashboardAccessStatus;
  source: AdminOperationsAccess["source"] | "root_owner" | "platform_role";
  allowed: boolean;
  isRootOwner: boolean;
  hasDashboardRead: boolean;
  checkedAt: string | null;
}>;

export const rootDashboardAccessService = {
  async resolveAccess(): Promise<RootDashboardAccessState> {
    const adminAccess = await adminOperationsService.getAccess();

    if (import.meta.env.DEV && dataSourceService.getStatus().isMock) {
      return {
        status: "allowed",
        source: "development",
        allowed: true,
        isRootOwner: true,
        hasDashboardRead: true,
        checkedAt: new Date().toISOString(),
      };
    }

    const client = getSupabaseClient();
    if (!client) {
      return {
        status: "denied",
        source: "none",
        allowed: false,
        isRootOwner: false,
        hasDashboardRead: false,
        checkedAt: new Date().toISOString(),
      };
    }

    const [rootResult, permResult] = await Promise.all([
      client.rpc("is_root_owner"),
      client.rpc("has_platform_permission", { permission_key: "dashboard.read" }),
    ]);

    const isRootOwner = !rootResult.error && rootResult.data === true;
    const hasDashboardRead = !permResult.error && permResult.data === true;
    const allowed = adminAccess.allowed || isRootOwner || hasDashboardRead;

    return {
      status: allowed ? "allowed" : "denied",
      source: isRootOwner
        ? "root_owner"
        : hasDashboardRead
          ? "platform_role"
          : adminAccess.source,
      allowed,
      isRootOwner,
      hasDashboardRead,
      checkedAt: new Date().toISOString(),
    };
  },
};
