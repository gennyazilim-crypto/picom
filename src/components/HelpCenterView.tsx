import { useMemo, useState } from "react";
import { AppIcon } from "./AppIcon";

type HelpTopic = {
  id: string;
  category: string;
  title: string;
  summary: string;
  steps: string[];
};

const helpTopics: HelpTopic[] = [
  {
    id: "getting-started",
    category: "Basics",
    title: "Getting started",
    summary: "Sign in, complete your profile, choose a theme, and learn the desktop layout.",
    steps: [
      "Sign in or register, then complete the first-run profile steps if prompted.",
      "Use the left rail for Home, direct messages, and communities.",
      "Use Ctrl + K for quick navigation and Ctrl + , to open Settings.",
    ],
  },
  {
    id: "joining-communities",
    category: "Communities",
    title: "Joining communities",
    summary: "Join public communities, use an invite, and understand visitor access.",
    steps: [
      "Open a community from the server rail or use an approved invite link.",
      "Public visitors can view only content explicitly available to visitors.",
      "Select Join Community to participate; private communities may require an invite or approval.",
    ],
  },
  {
    id: "sending-messages",
    category: "Chat",
    title: "Sending messages and images",
    summary: "Send, edit, reply, react, and attach supported images in a permitted channel.",
    steps: [
      "Select a text channel and type in the composer. Enter sends; Shift + Enter adds a line.",
      "Use message actions to reply, react, edit your own message, or delete when permitted.",
      "Attachments are validated before upload. Never upload secrets or files you do not trust.",
    ],
  },
  {
    id: "mention-feed",
    category: "Home",
    title: "Mention Feed",
    summary: "Review mentions, followed-person updates, stories, saved items, and channel context.",
    steps: [
      "Select Home in the server rail, then choose Feed or Takip Ettiğin Kişiler.",
      "Use filters and read/save controls to organize local feed state.",
      "Open in channel returns to the visible source channel when you have access.",
    ],
  },
  {
    id: "profiles",
    category: "People",
    title: "Profiles and relationships",
    summary: "Open a member profile, review public activity, and manage local follow state.",
    steps: [
      "Select a member name or avatar to open their profile.",
      "Profile activity and media should only include communities and channels you can access.",
      "Use Privacy & Safety settings to review blocking and relationship controls.",
    ],
  },
  {
    id: "voice-screen-share",
    category: "Voice",
    title: "Voice and screen sharing",
    summary: "Join a voice room, control audio, and share a selected desktop source safely.",
    steps: [
      "Open a voice channel and join after reviewing the room and device state.",
      "Mute stops publishing your microphone; deafen also stops incoming room audio.",
      "Screen share requires selecting one source. Operating-system permission may be required.",
    ],
  },
  {
    id: "privacy-safety",
    category: "Safety",
    title: "Privacy and safety",
    summary: "Control blocking, reports, notifications, account data, and sensitive information.",
    steps: [
      "Never share passwords, tokens, recovery codes, private invite links, or diagnostic secrets.",
      "Use message/member menus to report harmful content and block users where available.",
      "Request account data or review deletion status from Settings > Privacy & Safety.",
    ],
  },
  {
    id: "troubleshooting",
    category: "Support",
    title: "Troubleshooting",
    summary: "Recover from startup, connectivity, realtime, upload, voice, or packaging problems.",
    steps: [
      "Confirm Picom version, platform, network status, and whether mock or connected mode is active.",
      "Restart normally; use Safe Mode only when local settings or optional services block startup.",
      "Record reproducible steps and export redacted diagnostics before contacting support.",
    ],
  },
  {
    id: "diagnostics",
    category: "Support",
    title: "Exporting diagnostics",
    summary: "Create a redacted support bundle without exposing credentials or private content.",
    steps: [
      "Open Settings > Diagnostics and review the summary before export.",
      "Export logs or diagnostics, then inspect the file before attaching it to a report.",
      "Do not add passwords, tokens, authorization headers, private keys, or unrelated messages.",
    ],
  },
];

export function HelpCenterView() {
  const [query, setQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState(helpTopics[0].id);
  const filteredTopics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return helpTopics;
    return helpTopics.filter((topic) => [topic.title, topic.summary, topic.category, ...topic.steps].join(" ").toLowerCase().includes(normalized));
  }, [query]);
  const selectedTopic = helpTopics.find((topic) => topic.id === selectedTopicId) ?? filteredTopics[0] ?? null;

  return (
    <div className="help-center-view">
      <header className="help-center-header">
        <span className="eyebrow">Local support</span>
        <h3>Picom Help Center</h3>
        <p>Desktop guidance stored with the app. No internet connection is required.</p>
      </header>

      <label className="help-center-search">
        <AppIcon name="search" size="sm" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help topics" aria-label="Search help topics" />
      </label>

      <div className="help-center-layout">
        <nav className="help-topic-list" aria-label="Help topics">
          {filteredTopics.map((topic) => (
            <button key={topic.id} type="button" className={selectedTopic?.id === topic.id ? "active" : ""} onClick={() => setSelectedTopicId(topic.id)}>
              <span><small>{topic.category}</small><strong>{topic.title}</strong></span>
              <AppIcon name="chevronRight" size="xs" />
            </button>
          ))}
          {!filteredTopics.length ? <div className="help-empty">No local help topic matches this search.</div> : null}
        </nav>

        <article className="help-topic-detail" aria-live="polite">
          {selectedTopic ? (
            <>
              <span>{selectedTopic.category}</span>
              <h4>{selectedTopic.title}</h4>
              <p>{selectedTopic.summary}</p>
              <ol>{selectedTopic.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </>
          ) : (
            <p>Clear the search to browse all local help topics.</p>
          )}
        </article>
      </div>
    </div>
  );
}

