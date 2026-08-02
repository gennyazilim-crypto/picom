import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormStatus } from "../components/FormStatus";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

type ChangeStatus = "checking" | "success" | "invalid" | "expired" | "network";

export function ConfirmEmailChangePage() {
  const { opaqueCode } = useParams<{ opaqueCode?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const [status, setStatus] = useState<ChangeStatus>("checking");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const tokenHash = (params.get("token_hash") ?? "").trim();
    const type = (params.get("type") ?? "").trim();
    const pathCode = (opaqueCode ?? "").trim();

    if (pathCode && !tokenHash) {
      // Opaque email-change redeem is Account-gateway backed; fail closed safely until live.
      setStatus("expired");
      navigate(ROUTES.confirmEmailChange, { replace: true });
      return;
    }

    window.history.replaceState({}, document.title, ROUTES.confirmEmailChange);
    if (!tokenHash || type !== "email_change") {
      setStatus("invalid");
      return;
    }
    const run = async () => {
      try {
        const supabase = getAccountSupabase();
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email_change" });
        if (error) {
          setStatus(error.message.toLowerCase().includes("expired") ? "expired" : "invalid");
          return;
        }
        await supabase.auth.signOut({ scope: "local" });
        setStatus("success");
      } catch {
        setStatus("network");
      }
    };
    void run();
  }, [navigate, opaqueCode, params]);

  return (
    <section className="ac-card ac-stack">
      <h1>E-posta adresi değişikliği</h1>
      {status === "checking" ? <FormStatus tone="loading" message="Güvenli e-posta değişikliği bağlantısı kontrol ediliyor…" /> : null}
      {status === "success" ? <FormStatus tone="success" message="PICOM hesap e-posta adresin güncellendi." /> : null}
      {status === "invalid" ? <FormStatus tone="error" message="Bu bağlantı daha önce kullanılmış veya geçersiz." /> : null}
      {status === "expired" ? <FormStatus tone="error" message="Bu doğrulama bağlantısının süresi dolmuş. Yeni bir bağlantı isteyebilirsin." /> : null}
      {status === "network" ? <FormStatus tone="error" message="İşlem tamamlanamadı. Lütfen tekrar dene." /> : null}
      <div className="ac-actions">
        <Link className="ac-btn ac-btn--primary" to={ROUTES.login}>Girişe devam et</Link>
        <Link className="ac-btn ac-btn--secondary" to={ROUTES.security}>Hesap güvenliği</Link>
      </div>
    </section>
  );
}
