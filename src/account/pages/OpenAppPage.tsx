import { Link, useParams } from "react-router-dom";
import { FormStatus } from "../components/FormStatus";
import { APP_ORIGIN, SUPPORT_HOME_URL } from "../config";
import { ROUTES } from "../routes";

/**
 * Desktop handoff landing: opaque code is redeemed server-side later.
 * Never echoes the code into UI copy or lasting query strings.
 */
export function OpenAppPage() {
  const { opaqueCode } = useParams<{ opaqueCode?: string }>();
  const hasCode = Boolean(opaqueCode?.trim());

  return (
    <section className="ac-card ac-stack">
      <h1>PICOM uygulamasını aç</h1>
      {hasCode ? (
        <FormStatus tone="loading" message="Uygulama bağlantısı hazırlanıyor…" />
      ) : (
        <FormStatus tone="error" message="Bu bağlantı geçersiz veya süresi dolmuş." />
      )}
      <div className="ac-actions">
        <a className="ac-btn ac-btn--primary" href="picom://auth/open">PICOM’u aç</a>
        <a className="ac-btn ac-btn--secondary" href={APP_ORIGIN}>Web uygulaması</a>
        <Link className="ac-btn ac-btn--secondary" to={ROUTES.login}>Giriş</Link>
        <a className="ac-btn ac-btn--secondary" href={SUPPORT_HOME_URL}>Destek</a>
      </div>
    </section>
  );
}
