import { Navigate } from "react-router-dom";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { ROUTES } from "../routes";

export function GuestOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="ac-status ac-status--loading">{t("guest.redirect")}</div>;
  }

  if (session) {
    return <Navigate to={ROUTES.accountOverview} replace />;
  }

  return <>{children}</>;
}
