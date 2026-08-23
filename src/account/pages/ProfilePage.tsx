import { FormEvent, useEffect, useState } from "react";
import { ProfileMediaEditor } from "../../components/settings/ProfileMediaEditor";
import type { ProfileSummary } from "../../services/profileService";
import { FormStatus } from "../components/FormStatus";
import { AccountCard } from "../components/ui";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { getAccountSupabase } from "../lib/supabase";

type ProfileRow = {
  username: string;
  display_name: string;
  bio: string | null;
  country_code?: string | null;
  timezone?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
};

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = getAccountSupabase();
    void supabase
      .from("profiles")
      .select("username,display_name,bio,country_code,timezone,avatar_url,cover_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (loadError) setError(t("common.error"));
        else setProfile((data as ProfileRow | null) ?? null);
        setLoading(false);
      });
  }, [user]);

  const onMediaUpdated = (next: ProfileSummary) => {
    setProfile((current) =>
      current
        ? {
            ...current,
            display_name: next.displayName || current.display_name,
            username: next.username || current.username,
            bio: next.bio ?? current.bio,
            avatar_url: next.avatarUrl ?? null,
            cover_url: next.coverUrl ?? null,
          }
        : current,
    );
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    const supabase = getAccountSupabase();
    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name.trim(),
        bio: profile.bio?.trim() || null,
        country_code: profile.country_code?.trim().toUpperCase().slice(0, 2) || null,
        timezone: profile.timezone?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (saveError) setError(t("common.error"));
    else setMessage(t("profile.saved"));
  };

  if (loading) return <FormStatus tone="loading" message={t("common.loading")} />;
  if (!profile) return <FormStatus tone="error" message={error ?? t("common.error")} />;

  const displayName = profile.display_name || profile.username;

  return (
    <section className="ac-page ac-page--narrow">
      <div className="ac-stack">
        <AccountCard title={t("profile.photos")}>
          <p className="ac-muted" style={{ margin: "0 0 0.85rem" }}>{t("profile.photoHint")}</p>
          <ProfileMediaEditor
            displayName={displayName}
            avatarUrl={profile.avatar_url}
            coverUrl={profile.cover_url}
            onProfileUpdated={onMediaUpdated}
          />
        </AccountCard>

        <form className="ac-stack" onSubmit={onSubmit}>
          <AccountCard title={t("profile.title")}>
            <div className="ac-form" style={{ display: "grid", gap: "0.9rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.85rem" }}>
                <label className="ac-field">
                  <span>{t("common.displayName")}</span>
                  <input
                    required
                    maxLength={64}
                    value={profile.display_name}
                    onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  />
                </label>
                <label className="ac-field">
                  <span>{t("common.username")}</span>
                  <input value={profile.username} readOnly />
                </label>
              </div>
              <label className="ac-field">
                <span>{t("profile.bio")}</span>
                <textarea
                  maxLength={280}
                  rows={4}
                  value={profile.bio ?? ""}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                />
                <span className="ac-muted">{(profile.bio ?? "").length} / 280</span>
              </label>
            </div>
          </AccountCard>

          <AccountCard title={t("profile.location")}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.85rem" }}>
              <label className="ac-field">
                <span>{t("profile.country")}</span>
                <input
                  maxLength={2}
                  value={profile.country_code ?? ""}
                  onChange={(e) => setProfile({ ...profile, country_code: e.target.value })}
                />
              </label>
              <label className="ac-field">
                <span>{t("profile.timezone")}</span>
                <input
                  value={profile.timezone ?? ""}
                  onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  placeholder="Europe/Istanbul"
                />
              </label>
            </div>
          </AccountCard>

          <FormStatus tone="success" message={message} />
          <FormStatus tone="error" message={error} />
          <button className="ac-btn ac-btn--primary" type="submit" disabled={saving}>
            {saving ? t("form.working") : t("profile.save")}
          </button>
        </form>
      </div>
    </section>
  );
}
