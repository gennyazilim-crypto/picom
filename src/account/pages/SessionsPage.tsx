import { useEffect, useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { AccountCard, EmptyState, StatusBadge } from "../components/ui";
import { IconDevices } from "../components/AccountIcons";
import { t } from "../i18n/messages";
import { getAccountSupabase } from "../lib/supabase";

type SessionRow = {
  id: string;
  device_label: string;
  platform_label: string;
  runtime_label: string;
  created_at: string;
  last_used_at: string;
  current: boolean;
  revoked_at: string | null;
};

export function SessionsPage() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const supabase = getAccountSupabase();
    const { data, error: loadError } = await supabase.rpc("list_current_user_device_sessions");
    if (loadError) setError(t("sessions.loadError"));
    else setRows((data as SessionRow[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const revokeOthers = async () => {
    setError(null);
    const supabase = getAccountSupabase();
    const { error: authError } = await supabase.auth.signOut({ scope: "others" });
    if (authError) {
      setError(authError.message);
      return;
    }
    const { error: revokeError } = await supabase.rpc("revoke_other_device_sessions");
    if (revokeError) {
      setError(revokeError.message);
      return;
    }
    setMessage(t("sessions.revoked"));
    await reload();
  };

  const activeCount = rows.filter((row) => !row.revoked_at).length;

  return (
    <section className="ac-page ac-page--narrow">
      <AccountCard
        title={t("sessions.title")}
        icon={<IconDevices />}
        actions={
          <button className="ac-btn ac-btn--secondary" type="button" onClick={() => void revokeOthers()}>
            {t("sessions.signOutOthers")}
          </button>
        }
      >
        <p className="ac-muted" style={{ marginTop: 0 }}>
          {t("sessions.subtitle")}
          {!loading ? ` · ${activeCount}` : null}
        </p>
        {loading ? <FormStatus tone="loading" message={t("common.loading")} /> : null}
        {!loading && rows.length === 0 ? <EmptyState title={t("sessions.empty")} /> : null}
        {rows.map((row) => (
          <div className="ac-session-item" key={row.id}>
            <div>
              <strong>{row.device_label}</strong>
              {row.current ? (
                <>
                  {" "}
                  <StatusBadge tone="success">{t("sessions.currentDevice")}</StatusBadge>
                </>
              ) : null}
              <p className="ac-session-item__meta">
                {row.platform_label} / {row.runtime_label}
                {" · "}
                {new Date(row.last_used_at).toLocaleString()}
                {row.revoked_at ? " · revoked" : null}
              </p>
            </div>
          </div>
        ))}
        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />
      </AccountCard>
    </section>
  );
}
