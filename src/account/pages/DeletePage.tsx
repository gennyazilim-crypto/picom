import { FormEvent, useEffect, useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { getAccountSupabase } from "../lib/supabase";

export function DeletePage() {
  const { user, signOut } = useAuth();
  const [username, setUsername] = useState("");
  const [expectedUsername, setExpectedUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ack, setAck] = useState(false);
  const [activeRequest, setActiveRequest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
      const supabase = getAccountSupabase();
      const [{ data: profile }, { data: request }] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
        supabase
          .from("account_deletion_requests")
          .select("id,status")
          .in("status", ["requested", "reviewing"])
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setExpectedUsername(profile?.username ?? "");
      setActiveRequest(Boolean(request));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const requestDeletion = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.email || !ack) {
      setError(t("common.required"));
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = getAccountSupabase();
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (reauthError) {
      setLoading(false);
      setError(t("password.reauthFailed"));
      return;
    }

    const { data, error: invokeError } = await supabase.functions.invoke("account-deletion", {
      body: { action: "request", confirmationUsername: username.trim() },
    });
    setLoading(false);
    if (invokeError || (data as { status?: string } | null)?.status !== "requested") {
      setError(invokeError?.message || t("common.error"));
      return;
    }
    setActiveRequest(true);
    setMessage(t("delete.requested"));
    await supabase.auth.signOut({ scope: "global" });
    await signOut();
  };

  const cancelDeletion = async () => {
    setLoading(true);
    setError(null);
    const supabase = getAccountSupabase();
    const { data, error: invokeError } = await supabase.functions.invoke("account-deletion", {
      body: { action: "cancel" },
    });
    setLoading(false);
    if (invokeError || (data as { status?: string } | null)?.status !== "canceled") {
      setError(invokeError?.message || t("common.error"));
      return;
    }
    setActiveRequest(false);
    setMessage(t("delete.canceled"));
  };

  return (
    <section className="ac-page">
      <h1>{t("delete.title")}</h1>
      <p className="ac-muted">{t("delete.body")}</p>
      <div className="ac-danger-zone ac-stack">
        <h2>{t("delete.danger")}</h2>
        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />
        {activeRequest ? (
          <button type="button" className="ac-btn ac-btn--ghost" disabled={loading} onClick={() => void cancelDeletion()}>
            {loading ? t("form.working") : t("delete.cancelRequest")}
          </button>
        ) : (
          <form className="ac-form" onSubmit={(e) => void requestDeletion(e)}>
            <label className="ac-field">
              <span>{t("password.current")}</span>
              <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="ac-field">
              <span>{t("delete.confirmUsername")}</span>
              <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder={expectedUsername || undefined} />
            </label>
            <label className="ac-check">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>{t("delete.danger")}</span>
            </label>
            <button className="ac-btn ac-btn--danger" type="submit" disabled={loading}>
              {loading ? t("form.working") : t("delete.submit")}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
