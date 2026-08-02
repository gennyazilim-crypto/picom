import { useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { getAccountSupabase } from "../lib/supabase";

export function DataExportPage() {
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestExport = async () => {
    setBusy(true);
    setError(null);
    setMessage(t("export.processing"));
    setPayload(null);
    const supabase = getAccountSupabase();
    const { data, error: invokeError } = await supabase.functions.invoke("user-data-export", {
      body: {},
    });
    setBusy(false);
    if (invokeError || !data) {
      setError(invokeError?.message || t("export.failed"));
      setMessage(null);
      return;
    }
    setPayload(data as Record<string, unknown>);
    setMessage(t("export.ready"));
  };

  const download = () => {
    if (!payload) return;
    const exportId = typeof payload.exportId === "string" ? payload.exportId : "export";
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `picom-data-export-${exportId}.json`;
    anchor.rel = "noopener";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="ac-page">
      <h1>{t("export.title")}</h1>
      <p className="ac-muted">{t("export.body")}</p>
      <FormStatus tone="success" message={message} />
      <FormStatus tone="error" message={error} />
      <div className="ac-actions">
        <button className="ac-btn ac-btn--primary" type="button" disabled={busy} onClick={() => void requestExport()}>
          {busy ? t("form.working") : t("export.request")}
        </button>
        <button className="ac-btn ac-btn--ghost" type="button" disabled={!payload} onClick={download}>
          {t("export.download")}
        </button>
      </div>
    </section>
  );
}
