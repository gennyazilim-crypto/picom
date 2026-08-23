import { AppIcon, type IconName } from "../AppIcon";
import type { OnboardingStartChoice } from "../../types/onboarding";
import { getCommunityKindInviteSummary } from "../../services/community/communityJoinRoutingService";
import { useTranslation } from "../../i18n";

type Props = { value: OnboardingStartChoice; inviteCode: string; onChange: (value: OnboardingStartChoice) => void; onInviteCodeChange: (value: string) => void };
const communityKinds = ([
  { kind: "text" as const, icon: "hash" as IconName },
  { kind: "radio" as const, icon: "headphones" as IconName },
  { kind: "podcast" as const, icon: "microphone" as IconName },
]).map((item) => ({ ...item, summary: getCommunityKindInviteSummary(item.kind) }));

export function OnboardingStepCommunity({ value, inviteCode, onChange, onInviteCodeChange }: Props) {
  const { t } = useTranslation("common");
  const choices: Array<{ id: OnboardingStartChoice; title: string; description: string; icon: IconName }> = [
    { id: "createCommunity", title: t("onboarding.createCommunity"), description: t("onboarding.createCommunityDescription"), icon: "plus" },
    { id: "joinInvite", title: t("onboarding.joinInvite"), description: t("onboarding.joinInviteDescription"), icon: "users" },
    { id: "mentionFeed", title: t("onboarding.continueWithoutCommunity"), description: t("onboarding.continueWithoutCommunityDescription"), icon: "home" },
  ];
  return (
    <section className="onboarding-step" aria-labelledby="onboarding-community-title">
      <div className="onboarding-step-heading"><span className="onboarding-step-icon"><AppIcon name="hash" size="lg" /></span><div><p className="eyebrow">{t("onboarding.communityEntry")}</p><h2 id="onboarding-community-title">{t("onboarding.communityTitle")}</h2><p>{t("onboarding.communityBody")}</p></div></div>
      <div className="onboarding-choice-grid" role="radiogroup" aria-label={t("onboarding.communityEntry")}>
        {choices.map((choice) => <button key={choice.id} type="button" role="radio" aria-checked={value === choice.id} className={`onboarding-choice ${value === choice.id ? "selected" : ""}`} onClick={() => onChange(choice.id)}><span><AppIcon name={choice.icon} size="md" /></span><strong>{choice.title}</strong><small>{choice.description}</small></button>)}
      </div>
      <div className="onboarding-choice-grid" aria-label="Picom community kind recommendations">
        {communityKinds.map(({ kind, icon, summary }) => <article key={kind} className="onboarding-choice"><span><AppIcon name={icon} size="md" /></span><strong>{summary.label}</strong><small>{summary.capabilitySummary.join(" / ")}</small><small>{t("onboarding.startsAt", { destination: summary.landingLabel })}</small></article>)}
      </div>
      {value === "joinInvite" ? <label className="onboarding-invite-field"><span>{t("onboarding.inviteCode")}</span><input value={inviteCode} maxLength={128} onChange={(event) => onInviteCodeChange(event.target.value)} placeholder="picom://invite/..." /></label> : null}
    </section>
  );
}
