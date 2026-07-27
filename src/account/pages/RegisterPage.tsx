import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { FormStatus } from "../components/FormStatus";
import { ACCOUNT_AUTH, LEGAL_POLICY_VERSION } from "../config";
import { t } from "../i18n/messages";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("");
  const [language, setLanguage] = useState("en");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameHint, setUsernameHint] = useState<string | null>(null);

  const checkUsername = async () => {
    const candidate = username.trim();
    if (!USERNAME_PATTERN.test(candidate)) {
      setUsernameHint(t("register.usernameTaken"));
      return false;
    }
    const supabase = getAccountSupabase();
    const { data, error: rpcError } = await supabase.rpc("check_username_availability", {
      candidate,
    });
    if (rpcError) {
      setUsernameHint(null);
      return true;
    }
    const available = Boolean((data as { available?: boolean } | null)?.available);
    setUsernameHint(available ? t("register.usernameAvailable") : t("register.usernameTaken"));
    return available;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }
    if (!terms || !privacy || !ageOk) {
      setError(t("common.required"));
      return;
    }
    setLoading(true);
    const usernameOk = await checkUsername();
    if (!usernameOk) {
      setLoading(false);
      setError(t("register.usernameTaken"));
      return;
    }

    const supabase = getAccountSupabase();
    const normalizedEmail = email.trim().toLowerCase();
    const profileMeta = {
      username: username.trim().toLowerCase(),
      display_name: displayName.trim(),
      birth_date: birthDate,
      country_code: country.trim().toUpperCase().slice(0, 2),
      preferred_language: language,
      marketing_opt_in: marketing,
      terms_version: LEGAL_POLICY_VERSION.terms,
      privacy_version: LEGAL_POLICY_VERSION.privacy,
    };

    let session = null as Awaited<ReturnType<typeof supabase.auth.signUp>>["data"]["session"];
    let user = null as Awaited<ReturnType<typeof supabase.auth.signUp>>["data"]["user"];

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: ACCOUNT_AUTH.emailRedirectTo,
        data: profileMeta,
      },
    });

    if (signUpError) {
      const alreadyRegistered = /already\s*registered|already\s*exists|user_already_exists/i.test(
        `${signUpError.message} ${signUpError.code ?? ""}`,
      );
      if (alreadyRegistered) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError || !signInData.session || !signInData.user) {
          setLoading(false);
          setError(t("register.alreadyRegistered"));
          return;
        }
        session = signInData.session;
        user = signInData.user;
      } else {
        setLoading(false);
        setError(signUpError.message || t("register.failed"));
        return;
      }
    } else {
      session = data.session;
      user = data.user;
    }

    if (!session || !user?.id) {
      setLoading(false);
      setError(t("register.sessionMissing"));
      return;
    }

    const { error: profileRpcError } = await supabase.rpc("register_account_center_profile", {
      p_username: username.trim().toLowerCase(),
      p_display_name: displayName.trim(),
      p_country_code: country.trim().toUpperCase().slice(0, 2) || null,
      p_preferred_language: language,
      p_birth_date: birthDate || null,
      p_marketing_opt_in: marketing,
      p_terms_version: LEGAL_POLICY_VERSION.terms,
      p_privacy_version: LEGAL_POLICY_VERSION.privacy,
    });
    if (profileRpcError) {
      const { error: insertError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          username: username.trim().toLowerCase(),
          display_name: displayName.trim(),
          accepted_terms_version: LEGAL_POLICY_VERSION.terms,
          accepted_privacy_version: LEGAL_POLICY_VERSION.privacy,
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (insertError) {
        console.warn("register profile fallback", insertError.message);
      }
    }

    void import("../lib/softEmailVerification").then(({ sendSoftEmailVerification }) =>
      sendSoftEmailVerification("send"),
    );

    const { continueToProduct, captureContinueContextFromLocation } = await import("../lib/continueToProduct");
    captureContinueContextFromLocation();
    const continued = await continueToProduct(session, { preferProduct: true });
    if (continued.redirected) {
      setLoading(false);
      return;
    }

    const { resolvePostLoginDestination } = await import("../lib/postLogin");
    const destination = await resolvePostLoginDestination(session, null);
    setLoading(false);
    navigate(destination.path, { replace: true });
  };

  return (
    <AuthSplitLayout
      wide
      eyebrow={t("register.hero.eyebrow")}
      title={t("register.hero.title")}
      subtitle={t("register.hero.subtitle")}
    >
      <div className="ac-auth-card-head">
        <p className="eyebrow">{t("brand.account")}</p>
        <h2>{t("register.title")}</h2>
        <p className="ac-muted">{t("register.subtitle")}</p>
      </div>

      <form className="ac-form ac-form--auth ac-form--register" onSubmit={onSubmit}>
        <fieldset className="ac-form-section" disabled={loading}>
          <legend>{t("register.section.credentials")}</legend>
          <label className="ac-field">
            <span>{t("common.email")}</span>
            <span className="ac-input-shell">
              <span className="ac-input-shell__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="m4.5 7.5 7.5 5.5 7.5-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </span>
          </label>
          <div className="ac-form-grid">
            <label className="ac-field">
              <span>{t("common.password")}</span>
              <span className="ac-input-shell">
                <input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </span>
            </label>
            <label className="ac-field">
              <span>{t("common.confirmPassword")}</span>
              <span className="ac-input-shell">
                <input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="ac-form-section" disabled={loading}>
          <legend>{t("register.section.profile")}</legend>
          <div className="ac-form-grid">
            <label className="ac-field">
              <span>{t("common.username")}</span>
              <span className="ac-input-shell">
                <input
                  type="text"
                  autoComplete="username"
                  required
                  pattern="[A-Za-z0-9_]{3,24}"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={() => void checkUsername()}
                />
              </span>
              {usernameHint ? <small className="ac-field-hint">{usernameHint}</small> : null}
            </label>
            <label className="ac-field">
              <span>{t("common.displayName")}</span>
              <span className="ac-input-shell">
                <input type="text" required maxLength={64} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </span>
            </label>
            <label className="ac-field">
              <span>{t("common.birthDate")}</span>
              <span className="ac-input-shell">
                <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </span>
            </label>
            <label className="ac-field">
              <span>{t("common.country")}</span>
              <span className="ac-input-shell">
                <input type="text" required maxLength={2} placeholder="TR" value={country} onChange={(e) => setCountry(e.target.value)} />
              </span>
            </label>
            <label className="ac-field ac-field--span">
              <span>{t("common.language")}</span>
              <span className="ac-input-shell">
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                </select>
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="ac-form-section ac-form-section--checks" disabled={loading}>
          <legend>{t("register.section.agreements")}</legend>
          <label className="ac-check">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
            <span>{t("register.terms")}</span>
          </label>
          <label className="ac-check">
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} required />
            <span>{t("register.privacy")}</span>
          </label>
          <label className="ac-check">
            <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} required />
            <span>{t("register.age")}</span>
          </label>
          <label className="ac-check">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>{t("register.marketing")}</span>
          </label>
        </fieldset>

        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--primary ac-btn--block ac-btn--auth" type="submit" disabled={loading}>
          {loading ? t("form.working") : t("register.submit")}
        </button>
      </form>

      <p className="ac-auth-card-footer-note">
        <Link to={ROUTES.login}>{t("register.loginLink")}</Link>
      </p>
    </AuthSplitLayout>
  );
}
