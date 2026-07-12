import { useMemo, useState } from "react";
import { HELP_SUPPORT_SECTION_IDS, type HelpSupportSectionId } from "../services/navigation/helpSupportNavigationService";
import { AppIcon } from "./AppIcon";

type HelpTopic = Readonly<{
  id: HelpSupportSectionId;
  category: string;
  title: string;
  summary: string;
  steps: readonly string[];
}>;

const allHelpTopics: readonly HelpTopic[] = [
  { id: "getting-started", category: "Basics", title: "Getting started", summary: "Sign in, complete your profile, and learn Picom's desktop navigation.", steps: ["Complete first-run onboarding after authentication.", "Use the global sidebar for Feed, Direct Messages, Communities, Settings, and Help.", "Use Ctrl + K for quick navigation. User Settings opens only from the global sidebar."] },
  { id: "install-update", category: "Desktop", title: "Install and update", summary: "Install Picom safely and recover from package problems.", steps: ["Use only an approved Picom V1 Windows package and verify its SHA-256 checksum.", "Windows may show an operating-system trust prompt until trusted signing evidence is complete.", "Production auto-update is not enabled; install approved updates manually."] },
  { id: "feed", category: "Feed", title: "Feed", summary: "Review mentions, stories, reactions, comments, and saved context.", steps: ["Select Feed in the global sidebar, then choose Feed or Takip Ettigin Kisiler.", "Use filters and read/save controls to organize local feed state.", "Open in channel returns to the source only while your access still permits it."] },
  { id: "communities", category: "Communities", title: "Communities", summary: "Join, browse, and administer communities without mixing settings scopes.", steps: ["Open Communities globally, then select a community from its nested rail.", "Visitors see only explicitly public content and cannot participate until joining.", "Community administration opens only from Community Header and follows role permissions."] },
  { id: "direct-messages", category: "Messages", title: "Direct Messages", summary: "Use participant-only conversations and privacy controls.", steps: ["Select Direct Messages globally and choose a conversation.", "Enter sends; Shift + Enter adds a line. Reply, reactions, attachments, mute, block, and report remain conversation-scoped.", "Only conversation participants may access DM metadata or content."] },
  { id: "troubleshooting", category: "Support", title: "Troubleshooting", summary: "Recover from startup, network, realtime, upload, voice, or package problems.", steps: ["Confirm Picom version, platform, network state, and data-source mode.", "Restart normally; use Safe Mode only when local settings or optional services block startup.", "Record reproducible steps and export redacted diagnostics before contacting support."] },
  { id: "export-diagnostics", category: "Support", title: "Export diagnostics", summary: "Create a redacted support bundle after explicit user action.", steps: ["Use Export Diagnostics in the support actions panel.", "Inspect generated JSON before sharing it.", "Never add passwords, tokens, authorization headers, private keys, or private messages."] },
  { id: "report-problem", category: "Support", title: "Report a problem", summary: "Prepare a redacted report without claiming an unavailable submission backend.", steps: ["Describe reproducible steps without private content or credentials.", "Copy the redacted report or export diagnostics.", "Automated submission is not configured in beta; use an approved support channel when provided."] },
];

export const helpTopics: readonly HelpTopic[] = allHelpTopics.filter((topic) => HELP_SUPPORT_SECTION_IDS.includes(topic.id));

export function HelpCenterView({ initialTopicId = "getting-started" }: Readonly<{ initialTopicId?: HelpSupportSectionId }>) {
  const [query, setQuery] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<HelpSupportSectionId>(initialTopicId);
  const filteredTopics = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return helpTopics;
    return helpTopics.filter((topic) => [topic.title, topic.summary, topic.category, ...topic.steps].join(" ").toLowerCase().includes(normalized));
  }, [query]);
  const selectedTopic = helpTopics.find((topic) => topic.id === selectedTopicId) ?? filteredTopics[0] ?? null;

  return (
    <div className="help-center-view">
      <header className="help-center-header"><span className="eyebrow">Local support</span><h3>Picom Help & Support</h3><p>Desktop guidance stored with the app. No internet connection is required.</p></header>
      <label className="help-center-search"><AppIcon name="search" size="sm" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help topics" aria-label="Search help topics" /></label>
      <div className="help-center-layout">
        <nav className="help-topic-list" aria-label="Help topics">
          {filteredTopics.map((topic) => <button key={topic.id} type="button" className={selectedTopic?.id === topic.id ? "active" : ""} onClick={() => setSelectedTopicId(topic.id)}><span><small>{topic.category}</small><strong>{topic.title}</strong></span><AppIcon name="chevronRight" size="xs" /></button>)}
          {!filteredTopics.length ? <div className="help-empty">No local help topic matches this search.</div> : null}
        </nav>
        <article className="help-topic-detail" aria-live="polite">
          {selectedTopic ? <><span>{selectedTopic.category}</span><h4>{selectedTopic.title}</h4><p>{selectedTopic.summary}</p><ol>{selectedTopic.steps.map((step) => <li key={step}>{step}</li>)}</ol></> : <p>Clear the search to browse all local help topics.</p>}
        </article>
      </div>
    </div>
  );
}
