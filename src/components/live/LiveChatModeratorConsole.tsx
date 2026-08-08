import { useEffect, useState, type FormEvent } from "react";
import { localizationService } from "../../services/localizationService";
import { translateLiveChat, type LiveChatI18nKey } from "../../services/localization/liveChatCatalog";
import { featureFlagService } from "../../services/featureFlagService";
import { liveChatService } from "../../services/live/liveChatService";
import { LiveStreamChatPanel } from "./LiveStreamChatPanel";
import "./LiveStreamChatPanel.css";

type Props = Readonly<{
  streamId: string;
  onNotice?: (message: string, kind?: "info" | "error" | "success") => void;
}>;

function t(key: LiveChatI18nKey, params?: Record<string, string | number>): string {
  return translateLiveChat(key, localizationService.getLanguage(), params);
}

export function LiveChatModeratorConsole({ streamId, onNotice }: Props) {
  const chatEnabled = featureFlagService.isEnabled("enableLiveChat");
  const moderationEnabled = featureFlagService.isEnabled("enableLiveModeration");
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);
  const [modUserId, setModUserId] = useState("");
  const [slowMode, setSlowMode] = useState(0);
  const [chatOn, setChatOn] = useState(true);
  const [followersOnly, setFollowersOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [linksAllowed, setLinksAllowed] = useState(true);

  const refresh = async () => {
    const result = await liveChatService.getModerationSnapshot(streamId);
    if (!result.ok) {
      onNotice?.(result.error.message, "error");
      setSnapshot(null);
      return;
    }
    setSnapshot(result.data);
    const state = await liveChatService.getViewerState(streamId);
    if (state.ok) {
      setSlowMode(state.data.slowModeSeconds);
      setChatOn(state.data.chatEnabled);
      setFollowersOnly(state.data.followersOnly);
      setVerifiedOnly(state.data.verifiedOnly);
      setLinksAllowed(state.data.linksAllowed);
    }
  };

  useEffect(() => {
    if (!chatEnabled || !moderationEnabled) return;
    void refresh();
  }, [chatEnabled, moderationEnabled, streamId]);

  if (!chatEnabled || !moderationEnabled) return null;

  const moderators = Array.isArray(snapshot?.moderators) ? snapshot.moderators : [];
  const timeouts = Array.isArray(snapshot?.timeouts) ? snapshot.timeouts : [];
  const bans = Array.isArray(snapshot?.bans) ? snapshot.bans : [];
  const audit = Array.isArray(snapshot?.recentAudit) ? snapshot.recentAudit : [];
  const reports = Array.isArray(snapshot?.openReports) ? snapshot.openReports : [];

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    const result = await liveChatService.updateSettings(streamId, {
      chatEnabled: chatOn,
      slowModeSeconds: slowMode,
      followersOnly,
      verifiedOnly,
      linksAllowed,
    });
    onNotice?.(result.ok ? t("chatSettings.save") : result.error.message, result.ok ? "success" : "error");
    if (result.ok) void refresh();
  };

  return (
    <div className="live-chat-mod-console" aria-label={t("controlRoom.moderation")}>
      <h2>{t("controlRoom.moderation")}</h2>
      <LiveStreamChatPanel streamId={streamId} onNotice={onNotice} />

      <section>
        <h3>{t("chatSettings.title")}</h3>
        <form onSubmit={saveSettings} className="live-stream-chat__composer">
          <label>
            <input type="checkbox" checked={chatOn} onChange={(e) => setChatOn(e.target.checked)} /> {t("chatSettings.enable")}
          </label>
          <label>
            {t("chatSettings.slowMode")}
            <select value={slowMode} onChange={(e) => setSlowMode(Number(e.target.value))} aria-label={t("chatSettings.slowMode")}>
              {[0, 5, 10, 30, 60, 120].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={followersOnly} onChange={(e) => setFollowersOnly(e.target.checked)} /> {t("chatSettings.followersOnly")}
          </label>
          <label>
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> {t("chatSettings.verifiedOnly")}
          </label>
          <label>
            <input type="checkbox" checked={linksAllowed} onChange={(e) => setLinksAllowed(e.target.checked)} /> {t("chatSettings.linksAllowed")}
          </label>
          <button type="submit">{t("chatSettings.save")}</button>
        </form>
      </section>

      <section>
        <h3>{t("moderators.title")}</h3>
        <form
          className="live-stream-chat__composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (!modUserId.trim()) return;
            void liveChatService.assignModerator(streamId, modUserId.trim()).then((result) => {
              onNotice?.(result.ok ? t("moderators.assign") : result.error.message, result.ok ? "success" : "error");
              if (result.ok) {
                setModUserId("");
                void refresh();
              }
            });
          }}
        >
          <label>
            {t("moderators.userId")}
            <input value={modUserId} onChange={(e) => setModUserId(e.target.value)} />
          </label>
          <button type="submit">{t("moderators.assign")}</button>
        </form>
        <ul>
          {moderators.map((row) => {
            const item = row as { userId?: string };
            if (!item.userId) return null;
            return (
              <li key={item.userId}>
                {item.userId}{" "}
                <button
                  type="button"
                  onClick={() => {
                    if (!globalThis.confirm(t("moderators.remove"))) return;
                    void liveChatService.removeModerator(streamId, item.userId!).then((result) => {
                      if (result.ok) void refresh();
                      else onNotice?.(result.error.message, "error");
                    });
                  }}
                >
                  {t("moderators.remove")}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3>{t("controlRoom.timeouts")}</h3>
        <ul>
          {timeouts.map((row) => {
            const item = row as { id?: string; userId?: string; expiresAt?: string };
            return (
              <li key={item.id ?? item.userId}>
                {item.userId} → {item.expiresAt}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3>{t("controlRoom.bans")}</h3>
        <ul>
          {bans.map((row) => {
            const item = row as { id?: string; userId?: string };
            if (!item.userId) return null;
            return (
              <li key={item.id ?? item.userId}>
                {item.userId}{" "}
                <button
                  type="button"
                  onClick={() => {
                    if (!globalThis.confirm(t("unban.confirm"))) return;
                    void liveChatService.unbanUser(streamId, item.userId!).then((result) => {
                      if (result.ok) void refresh();
                      else onNotice?.(result.error.message, "error");
                    });
                  }}
                >
                  {t("unban.action")}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3>{t("controlRoom.queue")}</h3>
        <ul>
          {reports.map((row) => {
            const item = row as { id?: string; category?: string; targetUserId?: string };
            return (
              <li key={item.id}>
                {item.category}: {item.targetUserId}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3>{t("controlRoom.audit")}</h3>
        <ul>
          {audit.map((row) => {
            const item = row as { id?: string; eventType?: string; createdAt?: string };
            return (
              <li key={item.id}>
                {item.eventType} @ {item.createdAt}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
