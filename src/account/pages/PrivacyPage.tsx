import { FormEvent, useEffect, useState } from "react";
import { FormStatus } from "../components/FormStatus";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { getAccountSupabase } from "../lib/supabase";

type PrivacyState = {
  visibility: "everyone" | "shared_communities" | "friends";
  showOnline: boolean;
  showLocation: boolean;
  showTimezone: boolean;
  showActivity: boolean;
  showMedia: boolean;
  showCommunities: boolean;
  showFriends: boolean;
  showFollows: boolean;
  showAudio: boolean;
};

const DEFAULTS: PrivacyState = {
  visibility: "everyone",
  showOnline: true,
  showLocation: true,
  showTimezone: true,
  showActivity: true,
  showMedia: true,
  showCommunities: true,
  showFriends: true,
  showFollows: true,
  showAudio: true,
};

export function PrivacyPage() {
  const { user } = useAuth();
  const [privacy, setPrivacy] = useState<PrivacyState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void getAccountSupabase()
      .from("profile_privacy_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) {
          setLoading(false);
          return;
        }
        setPrivacy({
          visibility: data.profile_visibility,
          showOnline: data.show_online_status,
          showLocation: data.show_location,
          showTimezone: data.show_timezone,
          showActivity: data.show_activity,
          showMedia: data.show_media,
          showCommunities: data.show_communities,
          showFriends: data.show_friends,
          showFollows: data.show_follows,
          showAudio: data.show_audio,
        });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const supabase = getAccountSupabase();
    const { error: saveError } = await supabase.rpc("update_profile_privacy_v3", {
      next_visibility: privacy.visibility,
      next_show_online_status: privacy.showOnline,
      next_show_location: privacy.showLocation,
      next_show_timezone: privacy.showTimezone,
      next_show_activity: privacy.showActivity,
      next_show_media: privacy.showMedia,
      next_show_communities: privacy.showCommunities,
      next_show_friends: privacy.showFriends,
      next_show_follows: privacy.showFollows,
      next_show_audio: privacy.showAudio,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setMessage(t("privacy.saved"));
  };

  if (loading) {
    return <FormStatus tone="loading" message={t("common.loading")} />;
  }

  return (
    <section className="ac-page">
      <h1>{t("privacy.title")}</h1>
      <form className="ac-form" onSubmit={(e) => void onSubmit(e)}>
        <label className="ac-field">
          <span>{t("privacy.visibility")}</span>
          <select
            value={privacy.visibility}
            onChange={(e) => setPrivacy((p) => ({ ...p, visibility: e.target.value as PrivacyState["visibility"] }))}
          >
            <option value="everyone">{t("privacy.everyone")}</option>
            <option value="shared_communities">{t("privacy.shared")}</option>
            <option value="friends">{t("privacy.friends")}</option>
          </select>
        </label>
        {(
          [
            ["showOnline", "privacy.online"],
            ["showLocation", "privacy.location"],
            ["showTimezone", "privacy.timezone"],
            ["showActivity", "privacy.activity"],
            ["showMedia", "privacy.media"],
            ["showCommunities", "privacy.communities"],
            ["showFriends", "privacy.friendsList"],
            ["showFollows", "privacy.follows"],
            ["showAudio", "privacy.audio"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="ac-check">
            <input
              type="checkbox"
              checked={privacy[key]}
              onChange={(e) => setPrivacy((p) => ({ ...p, [key]: e.target.checked }))}
            />
            <span>{t(label)}</span>
          </label>
        ))}
        <FormStatus tone="success" message={message} />
        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--primary" type="submit" disabled={saving}>
          {saving ? t("form.working") : t("common.save")}
        </button>
      </form>
    </section>
  );
}
