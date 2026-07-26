import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProfileCover } from "../../components/ProfileCover";
import { UserAvatar } from "../../components/UserAvatar";
import {
  IconDevices,
  IconExternal,
  IconKey,
  IconLock,
  IconMail,
  IconPencil,
  IconProfile,
  IconShield,
  IconSupport,
} from "../components/AccountIcons";
import { FormStatus } from "../components/FormStatus";
import { AccountCard, StatusBadge } from "../components/ui";
import { APP_HOME_URL, SUPPORT_HOME_URL } from "../config";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import {
  fetchSoftEmailVerificationStatus,
  sendSoftEmailVerification,
  type SoftEmailVerificationState,
} from "../lib/softEmailVerification";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

export function AccountOverviewPage() {
  const { user } = useAuth();
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emailState, setEmailState] = useState<SoftEmailVerificationState | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailInfo, setEmailInfo] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getAccountSupabase();
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      setMfaEnabled((data?.totp ?? []).some((factor) => factor.status === "verified"));
      setLoading(false);
    });
    void fetchSoftEmailVerificationStatus().then(setEmailState);
    if (!user) return;
    void supabase
      .from("profiles")
      .select("username,display_name,created_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { username?: string; display_name?: string; created_at?: string } | null;
        setUsername(row?.username ?? (user.user_metadata?.username as string | undefined) ?? "");
        setDisplayName(
          row?.display_name
            ?? (user.user_metadata?.display_name as string | undefined)
            ?? user.email?.split("@")[0]
            ?? "PICOM",
        );
        setCreatedAt(row?.created_at ?? user.created_at ?? null);
      });
    void supabase.rpc("list_current_user_device_sessions").then(({ data }) => {
      const rows = (data as unknown[] | null) ?? [];
      setSessionCount(rows.length);
    });
  }, [user]);

  const onResend = async () => {
    setEmailBusy(true);
    setEmailError(null);
    setEmailInfo(null);
    setEmailMessage(null);
    const result = await sendSoftEmailVerification("resend");
    setEmailBusy(false);
    if (!result.ok) {
      if (result.rateLimited) {
        setEmailInfo(t("softVerify.rateLimited"));
      } else {
        setEmailError(result.message || t("softVerify.deliveryFailed"));
      }
      return;
    }
    setEmailMessage(result.alreadyVerified ? t("softVerify.alreadyVerified") : t("softVerify.sent"));
    void fetchSoftEmailVerificationStatus().then(setEmailState);
  };

  const emailVerified = Boolean(emailState?.isEmailVerified);

  return (
    <section className="ac-page">
      <AccountCard className="ac-overview-hero" padded={false}>
        <div className="ac-overview-hero__banner">
          <ProfileCover
            userId={user?.id}
            label={`${displayName} cover`}
            className="ac-overview-hero__cover"
          />
        </div>
        <div className="ac-overview-hero__body">
          <div className="ac-overview-hero__avatar">
            <UserAvatar
              userId={user?.id}
              displayName={displayName}
              size={72}
              priority="eager"
            />
          </div>
          <div>
            <h2 className="ac-overview-hero__name">{displayName}</h2>
            <p className="ac-overview-hero__handle">{username ? `@${username}` : (emailState?.emailMasked ?? user?.email)}</p>
            <div className="ac-overview-meta">
              <div>
                <strong>{t("common.email")}</strong>
                <span>
                  {emailState?.emailMasked ?? user?.email}{" "}
                  <StatusBadge tone={emailVerified ? "success" : "warning"}>
                    {emailVerified ? t("softVerify.verifiedBadge") : t("softVerify.unverifiedBadge")}
                  </StatusBadge>
                </span>
              </div>
              <div>
                <strong>{t("overview.profileVerification")}</strong>
                <StatusBadge tone="neutral">{t("profileVerification.none")}</StatusBadge>
              </div>
              <div>
                <strong>{t("overview.memberSince")}</strong>
                <span>{createdAt ? new Date(createdAt).toLocaleDateString() : "—"}</span>
              </div>
            </div>
          </div>
          <Link className="ac-btn ac-btn--secondary" to={ROUTES.profile}>
            <IconPencil /> {t("overview.profile")}
          </Link>
        </div>
      </AccountCard>

      {!emailVerified ? (
        <div className="ac-alert-card ac-alert-card--compact" role="status">
          <IconMail />
          <div className="ac-alert-card__copy">
            <p className="ac-alert-card__title">{t("softVerify.unverifiedTitle")}</p>
            <p className="ac-alert-card__body">{t("softVerify.unverifiedBodyShort")}</p>
            <FormStatus tone="success" message={emailMessage} />
            <FormStatus tone="info" message={emailInfo} />
            <FormStatus tone="error" message={emailError} />
          </div>
          <div className="ac-alert-card__actions">
            <button className="ac-btn ac-btn--primary" type="button" disabled={emailBusy} onClick={() => void onResend()}>
              {emailBusy ? t("form.working") : t("softVerify.sendShort")}
            </button>
            <Link className="ac-btn ac-btn--ghost" to={ROUTES.emailVerification}>{t("overview.details")}</Link>
          </div>
        </div>
      ) : (
        <div className="ac-alert-card ac-alert-card--success" role="status">
          <IconMail />
          <div>
            <p className="ac-alert-card__title">{t("softVerify.verified")}</p>
            <p className="ac-alert-card__body">
              {emailState?.emailVerifiedAt
                ? `${t("softVerify.verifiedAt")}: ${new Date(emailState.emailVerifiedAt).toLocaleString()}`
                : (emailState?.emailMasked ?? user?.email)}
            </p>
          </div>
          <div className="ac-alert-card__actions">
            <Link className="ac-btn ac-btn--secondary" to={ROUTES.emailChange}>{t("softVerify.changeEmail")}</Link>
          </div>
        </div>
      )}

      <div className="ac-overview-grid">
        <AccountCard
          title={t("overview.securityTitle")}
          icon={<IconShield />}
          actions={<Link to={ROUTES.security}>{t("overview.viewAll")}</Link>}
        >
          {loading ? <FormStatus tone="loading" message={t("common.loading")} /> : null}
          <Link className="ac-security-check" to={ROUTES.passwordChange}>
            <IconKey />
            <div className="ac-security-check__copy">
              <strong>{t("overview.password")}</strong>
              <span>{t("overview.passwordSet")}</span>
            </div>
            <StatusBadge tone="success">{t("overview.set")}</StatusBadge>
          </Link>
          <Link className="ac-security-check" to={ROUTES.mfa}>
            <IconLock />
            <div className="ac-security-check__copy">
              <strong>{t("overview.mfa")}</strong>
              <span>{mfaEnabled ? t("overview.mfaOn") : t("overview.mfaOff")}</span>
            </div>
            <StatusBadge tone={mfaEnabled ? "success" : "warning"}>
              {mfaEnabled ? t("overview.set") : t("overview.off")}
            </StatusBadge>
          </Link>
          <Link className="ac-security-check" to={ROUTES.emailVerification}>
            <IconMail />
            <div className="ac-security-check__copy">
              <strong>{t("overview.emailStatus")}</strong>
              <span>{emailVerified ? t("softVerify.verified") : t("softVerify.unverified")}</span>
            </div>
            <StatusBadge tone={emailVerified ? "success" : "warning"}>
              {emailVerified ? t("overview.set") : t("overview.pending")}
            </StatusBadge>
          </Link>
          <Link className="ac-security-check" to={ROUTES.sessions}>
            <IconDevices />
            <div className="ac-security-check__copy">
              <strong>{t("overview.sessions")}</strong>
              <span>{sessionCount == null ? "—" : `${sessionCount}`}</span>
            </div>
            <StatusBadge tone="info">{t("overview.viewDevices")}</StatusBadge>
          </Link>
        </AccountCard>

        <AccountCard title={t("overview.quickActions")}>
          <div className="ac-quick-grid">
            <Link className="ac-quick-tile" to={ROUTES.profile}><IconProfile />{t("overview.profile")}</Link>
            <Link className="ac-quick-tile" to={ROUTES.passwordChange}><IconKey />{t("overview.changePassword")}</Link>
            <Link className="ac-quick-tile" to={ROUTES.mfa}><IconLock />{t("overview.enableMfa")}</Link>
            <Link className="ac-quick-tile" to={ROUTES.sessions}><IconDevices />{t("overview.viewDevices")}</Link>
            <a className="ac-quick-tile" href={SUPPORT_HOME_URL}><IconSupport />{t("overview.openSupport")}</a>
            <a className="ac-quick-tile" href={APP_HOME_URL}><IconExternal />{t("overview.openPicom")}</a>
          </div>
        </AccountCard>
      </div>

      <AccountCard title={t("overview.activity")} actions={<Link to={ROUTES.security}>{t("overview.viewAll")}</Link>}>
        <p className="ac-muted">{t("overview.activityUnavailable")}</p>
      </AccountCard>
    </section>
  );
}
