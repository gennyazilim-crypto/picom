import { useCallback, useEffect, useRef, useState } from "react";
import {
  accountPrivacySetupService,
  DIRECT_MESSAGE_POLICIES,
  FRIEND_REQUEST_POLICIES,
  PROFILE_VISIBILITIES,
  type AccountPrivacySnapshot,
  type FirstLaunchPrivacyReadyStatus,
} from "../../services/privacy/accountPrivacySetupService";
import { firstLaunchPrivacyReadyLabel } from "../../services/privacy/firstLaunchPrivacyReady";
import { globalPresenceService } from "../../services/presence/globalPresenceService";
import type { ProfileVisibility } from "../../types/profilePrivacy";
import { AppIcon } from "../AppIcon";

export type FirstLaunchPrivacySummary = FirstLaunchPrivacyReadyStatus;

type FirstLaunchPrivacySetupProps = Readonly<{
  t: (key: string) => string;
  onSummaryChange: (summary: FirstLaunchPrivacySummary) => void;
}>;

type ScreenState =
  | Readonly<{ phase: "loading" }>
  | Readonly<{ phase: "anonymous" | "unavailable" }>
  | Readonly<{ phase: "ready"; snapshot: AccountPrivacySnapshot }>;

const FRIEND_HINTS = {
  everyone: "privacy.friendRequests.everyoneHint",
  community_members: "privacy.friendRequests.communityMembersHint",
  friends_of_friends: "privacy.friendRequests.friendsOfFriendsHint",
  nobody: "privacy.friendRequests.nobodyHint",
} as const;

const FRIEND_LABELS = {
  everyone: "privacy.friendRequests.everyone",
  community_members: "privacy.friendRequests.communityMembers",
  friends_of_friends: "privacy.friendRequests.friendsOfFriends",
  nobody: "privacy.friendRequests.nobody",
} as const;

const DIRECT_HINTS = {
  everyone: "privacy.dm.everyoneHint",
  friends: "privacy.dm.friendsHint",
  no_one: "privacy.dm.noOneHint",
} as const;

const DIRECT_LABELS = {
  everyone: "privacy.dm.everyone",
  friends: "privacy.dm.friends",
  no_one: "privacy.dm.noOne",
} as const;

const PROFILE_HINTS = {
  everyone: "privacy.profile.everyoneHint",
  shared_communities: "privacy.profile.sharedCommunitiesHint",
  friends: "privacy.profile.friendsHint",
} as const;

const PROFILE_LABELS = {
  everyone: "privacy.profile.everyone",
  shared_communities: "privacy.profile.sharedCommunities",
  friends: "privacy.profile.friends",
} as const;

/** Account-only privacy controls. No policy is read or written until auth is confirmed. */
export function FirstLaunchPrivacySetup({ t, onSummaryChange }: FirstLaunchPrivacySetupProps) {
  const [screen, setScreen] = useState<ScreenState>({ phase: "loading" });
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const mutationVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setScreen({ phase: "loading" });
    setPending(false);
    setMutationError(null);
    const result = await accountPrivacySetupService.hydrate();
    if (version !== requestVersion.current) return;
    if (result.status === "ready") {
      setScreen({ phase: "ready", snapshot: result.snapshot });
      onSummaryChange(result);
      return;
    }
    setScreen({ phase: result.status });
    onSummaryChange(result);
  }, [onSummaryChange]);

  useEffect(() => {
    void refresh();
    return accountPrivacySetupService.subscribeToAccountChange(() => { void refresh(); });
  }, [refresh]);

  const apply = useCallback(async (operation: (snapshot: AccountPrivacySnapshot) => ReturnType<typeof accountPrivacySetupService.updateProfile>) => {
    if (screen.phase !== "ready") return;
    const version = ++mutationVersion.current;
    const accountId = screen.snapshot.accountId;
    setPending(true);
    setMutationError(null);
    const result = await operation(screen.snapshot);
    if (version !== mutationVersion.current) return;
    setPending(false);
    if (!result.ok) {
      setMutationError(result.reason === "account_changed" ? t("privacy.accountChanged") : t("privacy.updateFailed"));
      if (result.reason === "account_changed" || result.reason === "anonymous") void refresh();
      return;
    }
    if (result.snapshot.accountId !== accountId) {
      void refresh();
      return;
    }
    setScreen({ phase: "ready", snapshot: result.snapshot });
    onSummaryChange({ status: "ready", snapshot: result.snapshot });
    globalPresenceService.setSharingEnabled(result.snapshot.profile.showOnlineStatus);
  }, [onSummaryChange, refresh, screen, t]);

  if (screen.phase === "loading") {
    return <div className="first-launch-privacy-loading" aria-busy="true" role="status">{t("privacy.loading")}</div>;
  }

  if (screen.phase === "anonymous") {
    return <article className="first-launch-information-card first-launch-privacy-deferred">
      <span><AppIcon name="lock" size="lg" /></span>
      <div>
        <strong>{t("privacy.deferredTitle")}</strong>
        <p>{t("privacy.deferredBody")}</p>
      </div>
    </article>;
  }

  if (screen.phase !== "ready") {
    return <section className="first-launch-privacy-error" role="alert">
      <p>{t("privacy.loadFailed")}</p>
      <button type="button" className="secondary" onClick={() => void refresh()}>{t("privacy.retry")}</button>
    </section>;
  }

  const { snapshot } = screen;
  return <div className="first-launch-privacy-setup" aria-busy={pending}>
    <p className="first-launch-privacy-ownership">{t("privacy.accountOwned")}</p>
    <p className="first-launch-privacy-ownership">{t("privacy.existingKept")}</p>

    <section className="first-launch-desktop-group" aria-labelledby="first-launch-privacy-connect">
      <div className="first-launch-desktop-group-heading">
        <h3 id="first-launch-privacy-connect">{t("privacy.connectLegend")}</h3>
      </div>
      <fieldset className="first-launch-desktop-options" disabled={pending}>
        <legend>{t("privacy.friendRequests.label")}</legend>
        <p>{t("privacy.friendRequests.hint")}</p>
        <div role="radiogroup" aria-label={t("privacy.friendRequests.label")}>
          {FRIEND_REQUEST_POLICIES.map((value) => (
            <RadioOption
              key={value}
              name="first-launch-friend-request-privacy"
              value={value}
              checked={snapshot.friendRequestPrivacy === value}
              onChange={() => void apply((current) => accountPrivacySetupService.updateFriendRequestPrivacy(current.accountId, value))}
              label={t(FRIEND_LABELS[value])}
              description={t(FRIEND_HINTS[value])}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="first-launch-desktop-options" disabled={pending}>
        <legend>{t("privacy.dm.label")}</legend>
        <p>{t("privacy.dm.hint")}</p>
        <div role="radiogroup" aria-label={t("privacy.dm.label")}>
          {DIRECT_MESSAGE_POLICIES.map((value) => (
            <RadioOption
              key={value}
              name="first-launch-direct-message-privacy"
              value={value}
              checked={snapshot.directMessagePrivacy === value}
              onChange={() => void apply((current) => accountPrivacySetupService.updateDirectMessagePrivacy(current.accountId, value))}
              label={t(DIRECT_LABELS[value])}
              description={t(DIRECT_HINTS[value])}
            />
          ))}
        </div>
      </fieldset>
    </section>

    <section className="first-launch-desktop-group" aria-labelledby="first-launch-privacy-visibility">
      <div className="first-launch-desktop-group-heading">
        <h3 id="first-launch-privacy-visibility">{t("privacy.visibilityLegend")}</h3>
      </div>
      <fieldset className="first-launch-desktop-options" disabled={pending}>
        <legend>{t("privacy.profile.label")}</legend>
        <p>{t("privacy.profile.hint")}</p>
        <div role="radiogroup" aria-label={t("privacy.profile.label")}>
          {PROFILE_VISIBILITIES.map((value) => (
            <RadioOption
              key={value}
              name="first-launch-profile-visibility"
              value={value}
              checked={snapshot.profile.visibility === value}
              onChange={() => void apply((current) => accountPrivacySetupService.updateProfile(current.accountId, { visibility: value as ProfileVisibility }))}
              label={t(PROFILE_LABELS[value])}
              description={t(PROFILE_HINTS[value])}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="first-launch-desktop-options" disabled={pending}>
        <legend>{t("privacy.presence.label")}</legend>
        <p>{t("privacy.presence.hint")}</p>
        <div role="radiogroup" aria-label={t("privacy.presence.label")}>
          <RadioOption
            name="first-launch-presence-privacy"
            value="visible"
            checked={snapshot.profile.showOnlineStatus}
            onChange={() => void apply((current) => accountPrivacySetupService.updateProfile(current.accountId, { showOnlineStatus: true }))}
            label={t("privacy.presence.show")}
            description={t("privacy.presence.showHint")}
          />
          <RadioOption
            name="first-launch-presence-privacy"
            value="hidden"
            checked={!snapshot.profile.showOnlineStatus}
            onChange={() => void apply((current) => accountPrivacySetupService.updateProfile(current.accountId, { showOnlineStatus: false }))}
            label={t("privacy.presence.hide")}
            description={t("privacy.presence.hideHint")}
          />
        </div>
      </fieldset>
    </section>

    <section className="first-launch-desktop-group" aria-labelledby="first-launch-privacy-safety">
      <div className="first-launch-desktop-group-heading">
        <h3 id="first-launch-privacy-safety">{t("privacy.safetyLegend")}</h3>
        <p>{t("privacy.safety.body")}</p>
      </div>
      <article className="first-launch-privacy-safety-item"><strong>{t("privacy.safety.block")}</strong><p>{t("privacy.safety.blockHint")}</p></article>
      <article className="first-launch-privacy-safety-item"><strong>{t("privacy.safety.mute")}</strong><p>{t("privacy.safety.muteHint")}</p></article>
      <article className="first-launch-privacy-safety-item"><strong>{t("privacy.safety.report")}</strong><p>{t("privacy.safety.reportHint")}</p></article>
    </section>

    <p className="first-launch-privacy-status" aria-live="polite">{pending ? t("privacy.saving") : mutationError ?? ""}</p>
  </div>;
}

function RadioOption({ name, value, checked, onChange, label, description }: Readonly<{
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}>) {
  return (
    <label className="first-launch-desktop-radio">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} />
      <span><strong>{label}</strong><small>{description}</small></span>
    </label>
  );
}

export { firstLaunchPrivacyReadyLabel };
