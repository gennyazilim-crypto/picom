import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function VoiceOpsPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="voice_rooms"
      title="Voice Operations"
      purpose="Active rooms, join failures, and live voice capacity operations."
      emptyMessage="No voice rooms returned for this admin list."
    />
  );
}
