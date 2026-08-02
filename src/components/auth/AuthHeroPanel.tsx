import { brandLogoUrl } from "../../config/brandAssets";
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

const FEED_PREVIEW: readonly FeedPreviewItem[] = [
  {
    channel: "#announcements",
    author: "Maya Chen",
    initials: "MC",
    tone: "teal",
    body: "Sprint review moves to 17:00. Bring ship notes — voice room opens 5 minutes early.",
    meta: "2m · pinned",
  },
  {
    channel: "#design",
    author: "Noah Park",
    initials: "NP",
    tone: "ink",
    body: "Dropped the new channel header mock. Feed density feels closer to a focused desktop workspace without the noise.",
    meta: "14m",
  },
  {
    channel: "Voice · Ops Bridge",
    author: "Live room",
    initials: "VB",
    tone: "warm",
    body: "Screen share active · 6 in room · latency 28ms",
    meta: "now",
    live: true,
  },
  {
    channel: "DM · Lex Rivera",
    author: "Lex Rivera",
    initials: "LR",
    tone: "teal",
    body: "Can you review the moderation queue before standup?",
    meta: "28m · unread",
  },
];

const COPY: Record<AuthHeroVariant, { kicker: string; title: string; body: string }> = {
  login: {
    kicker: "Picom desktop",
    title: "Your communities, already waiting.",
    body: "Channels, DMs, and voice in one desktop shell — sign in to pick up the feed where you left off.",
  },
  register: {
    kicker: "Create account",
    title: "Join the desktop workspace.",
    body: "One account for communities, channels, and realtime chat. Built for Windows, Linux, and macOS.",
  },
  recovery: {
    kicker: "Account recovery",
    title: "Choose a new password.",
    body: "Use a unique password you do not reuse elsewhere. Picom never displays or logs recovery codes.",
  },
};

export function AuthHeroPanel({ variant = "login" }: AuthHeroPanelProps) {
  const copy = COPY[variant];
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
            <strong>Community feed</strong>
            <em>Live preview</em>
          </div>
          <div className="auth-feed-preview__rail">
            <span className="is-active"><AppIcon name="hash" size="sm" /> general</span>
            <span><AppIcon name="hash" size="sm" /> design</span>
            <span><AppIcon name="microphone" size="sm" /> voice</span>
            <span><AppIcon name="users" size="sm" /> members</span>
          </div>
          <ul className="auth-feed-preview__list">
            {FEED_PREVIEW.map((item) => (
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
