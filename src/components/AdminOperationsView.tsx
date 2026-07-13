import type { AdminOperationsAccess } from "../services/adminOperationsService";
import { AdminOperationsPanel } from "./AdminOperationsPanel";

type AdminOperationsViewProps = Readonly<{
  access: AdminOperationsAccess;
}>;

export function canAccessAdminOperationsView(access: AdminOperationsAccess): boolean {
  return access.allowed && (access.source === "development" || access.source === "app_admin");
}

export function AdminOperationsView({ access }: AdminOperationsViewProps) {
  if (!canAccessAdminOperationsView(access)) {
    return null;
  }

  return (
    <div className="admin-operations-settings-stack" data-access-source={access.source}>
      <AdminOperationsPanel access={access} />
    </div>
  );
}
