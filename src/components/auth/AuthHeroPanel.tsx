import { brandLogoUrl } from "../../config/brandAssets";
import { useTranslation } from "../../i18n";
import type { TFunction } from "../../i18n";
import { AppIcon } from "../AppIcon";

type AuthHeroVariant = "login" | "register" | "recovery";

type AuthHeroPanelProps = Readonly<{
  variant?: AuthHeroVariant;
}>;

type FeedPreviewItem = Readonly<{
  channel: string;
  author: string;
  initials: string;
  tone: "teal" | "ink" | "warm";
  body: string;
  meta: string;
  live?: boolean;
}>;

function buildFeedPreview(t: TFunction): readonly FeedPreviewItem[] {
  return [
    {
      channel: "#announcements",
      author: "Maya Chen",
      initials: "MC",
      tone: "teal",
      body: t("hero.preview.announcement.body"),
      meta: t("hero.preview.announcement.meta"),
    },
    {
      channel: "#design",
      author: "Noah Park",
      initials: "NP",
      tone: "ink",
      body: t("hero.preview.design.body"),
      meta: t("hero.preview.design.meta"),
    },
    {
      channel: t("hero.preview.voice.channel"),
      author: t("hero.preview.voice.author"),
      initials: "VB",
      tone: "warm",
      body: t("hero.preview.voice.body"),
      meta: t("hero.preview.voice.meta"),
      live: true,
    },
    {
      channel: "DM · Lex Rivera",
      author: "Lex Rivera",
      initials: "LR",
      tone: "teal",
      body: t("hero.preview.dm.body"),
      meta: t("hero.preview.dm.meta"),
    },
  ];
}

function buildCopy(t: TFunction): Record<AuthHeroVariant, { kicker: string; title: string; body: string }> {
  return {
    login: {
      kicker: t("hero.login.kicker"),
      title: t("hero.login.title"),
      body: t("hero.login.body"),
    },
    register: {
      kicker: t("hero.register.kicker"),
      title: t("hero.register.title"),
      body: t("hero.register.body"),
    },
    recovery: {
      kicker: t("hero.recovery.kicker"),
      title: t("hero.recovery.title"),
      body: t("hero.recovery.body"),
    },
  };
}

export function AuthHeroPanel({ variant = "login" }: AuthHeroPanelProps) {
  const { t } = useTranslation("auth");
  const copy = buildCopy(t)[variant];
  const feedPreview = buildFeedPreview(t);
  const showFeed = variant !== "recovery";

  return (
    <section className="auth-hero" aria-hidden="true">
      <header className="auth-hero-brand">
        <img className="auth-hero-mark" src={brandLogoUrl} alt="" />
        <div className="auth-hero-brand-text">
          <strong>Picom</strong>
          <span className="picom-beta-badge">Beta</span>
        </div>
      </header>

      <div className="auth-hero-copy">
        <p className="auth-hero-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </div>

      {showFeed ? (
        <div className="auth-feed-preview">
          <div className="auth-feed-preview__chrome">
            <span className="auth-feed-preview__dot" />
            <span className="auth-feed-preview__dot" />
            <span className="auth-feed-preview__dot" />
            <strong>{t("hero.preview.chrome.title")}</strong>
            <em>{t("hero.preview.chrome.badge")}</em>
          </div>
          <div className="auth-feed-preview__rail">
            <span className="is-active"><AppIcon name="hash" size="sm" /> general</span>
            <span><AppIcon name="hash" size="sm" /> design</span>
            <span><AppIcon name="microphone" size="sm" /> voice</span>
            <span><AppIcon name="users" size="sm" /> members</span>
          </div>
          <ul className="auth-feed-preview__list">
            {feedPreview.map((item) => (
              <li key={`${item.channel}-${item.meta}`} className={item.live ? "is-live" : undefined}>
                <span className={`auth-feed-avatar auth-feed-avatar--${item.tone}`} aria-hidden="true">{item.initials}</span>
                <div className="auth-feed-item-copy">
                  <div className="auth-feed-item-meta">
                    <strong>{item.author}</strong>
                    <span>{item.channel}</span>
                    <time>{item.meta}</time>
                  </div>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
