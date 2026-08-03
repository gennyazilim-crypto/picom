import type { MouseEvent } from "react";
import "./ProfileView.css";
import type { Attachment, Community, Member } from "../types/community";
import type { ProfileActivityItem, ProfileMediaItem, UserProfile } from "../types/profile";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon, type IconName } from "./AppIcon";
import { VerifiedProfileAvatar } from "./VerifiedProfileAvatar";
import { ProfileCover } from "./ProfileCover";
import { useProfileDisplayName, useProfileUsername } from "./ProfileDisplayName";
import { getUserVerificationSummary } from "../utils/verificationHelpers";
import { useAudioCatalogState } from "../hooks/useAudioCatalog";
import { ProfileAudioSections } from "./audio/ProfileAudioSections";
import { isV1FeatureEnabled } from "../config/v1ReleaseScope";
import { getCommunityIconLabel, resolveCommunityMarkSrc } from "../utils/generatedIdentity";
import { ensureCommunityMemberRoster } from "../utils/ensureCommunityMemberRoster";

type ProfileViewProps = {
  profile: UserProfile;
  member: Member;
  communities: Community[];
  currentUserId: string;
  onBack: () => void;
  onToggleFollow: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onFriendAction?: (userId: string, action: "add" | "cancel" | "accept" | "remove") => void;
  onOpenActivity: (activity: ProfileActivityItem) => void;
  onOpenImage: (attachment: Attachment) => void;
  onEditProfile?: () => void;
  onRequestVerification?: () => void;
  isBlocked?: boolean;
  relationshipBusy?: boolean;
  onOpenMore?: (event: MouseEvent, profile: UserProfile) => void;
  onOpenCommunity?: (communityId: string) => void;
  onOpenBookmarks?: () => void;
  dataState?: "idle" | "loading" | "ready" | "error";
  dataError?: string | null;
  onRetryData?: () => void;
};

type ProfileActionButtonsProps = {
  profile: UserProfile;
  isCurrentUser: boolean;
  onToggleFollow: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onFriendAction?: (userId: string, action: "add" | "cancel" | "accept" | "remove") => void;
  onEditProfile?: () => void;
  onRequestVerification?: () => void;
  isBlocked?: boolean;
  relationshipBusy?: boolean;
  onOpenMore?: (event: MouseEvent, profile: UserProfile) => void;
};

function profileMediaToAttachment(media: ProfileMediaItem): Attachment {
  return {
    id: media.id,
    type: "image",
    url: media.url,
    publicUrl: media.url,
    thumbnailUrl: media.thumbnailUrl ?? media.url,
    alt: media.title ?? "Profile media",
    scanStatus: "clean",
  };
}

function getCommunityName(communities: Community[], communityId?: string) {
  if (!communityId) return "Visible community";
  return communities.find((community) => community.id === communityId)?.name ?? "Visible community";
}

function getChannelName(communities: Community[], communityId?: string, channelId?: string) {
  if (!communityId || !channelId) return "channel";
  const community = communities.find((candidate) => candidate.id === communityId);
  return community?.categories.flatMap((category) => category.channels).find((channel) => channel.id === channelId)?.name ?? "channel";
}

function getActivityIcon(type: ProfileActivityItem["type"]): IconName {
  if (type === "media_share") return "image";
  if (type === "reply") return "reply";
  if (type === "reaction") return "smile";
  if (type === "voice_join") return "voice";
  if (type === "mention") return "bell";
  return "hash";
}

function statusLabel(status: UserProfile["status"]) {
  if (status === "busy") return "Busy";
  if (status === "idle") return "Idle";
  if (status === "offline") return "Offline";
  return "Online";
}

function friendActionLabel(status: UserProfile["friendshipStatus"], busy: boolean): string {
  if (busy) return "Updating…";
  if (status === "friends") return "Unfriend";
  if (status === "outgoing") return "Cancel";
  if (status === "incoming") return "Accept";
  return "Add";
}

function ProfileActionButtons({ profile, isCurrentUser, onToggleFollow, onMessage, onFriendAction, onEditProfile, onRequestVerification, isBlocked = false, relationshipBusy = false, onOpenMore }: ProfileActionButtonsProps) {
  if (isCurrentUser) {
    return (
      <div className="profile-action-row" role="group" aria-label="Profile actions">
        {onEditProfile ? (
          <button type="button" className="profile-btn profile-btn--primary profile-btn--block" onClick={onEditProfile}>
            <span className="profile-btn-icon" aria-hidden="true"><AppIcon name="edit" size="sm" /></span>
            <span className="profile-btn-label">Edit profile</span>
          </button>
        ) : null}
        <div className={`profile-action-secondary${onRequestVerification ? "" : " profile-action-secondary--compact"}`}>
          {onRequestVerification ? (
            <button type="button" className="profile-btn profile-btn--ghost profile-btn--secondary" onClick={onRequestVerification}>
              <span className="profile-btn-label">Verification</span>
            </button>
          ) : null}
          <button type="button" className="profile-btn profile-btn--ghost profile-btn--icon" aria-label="More profile actions" onClick={(event) => onOpenMore?.(event, profile)}>
            <AppIcon name="more" size="sm" />
          </button>
        </div>
      </div>
    );
  }

  const friendLabel = friendActionLabel(profile.friendshipStatus, relationshipBusy);
  const followLabel = profile.isFollowing ? "Unfollow" : "Follow";

  return (
    <div className="profile-action-row" role="group" aria-label="Profile actions">
      <button type="button" className="profile-btn profile-btn--primary profile-btn--block" disabled={isBlocked || relationshipBusy} onClick={() => onMessage?.(profile.id)}>
        <span className="profile-btn-icon" aria-hidden="true"><AppIcon name="send" size="sm" /></span>
        <span className="profile-btn-label">Message</span>
      </button>
      <div className="profile-action-secondary">
        <button
          type="button"
          className="profile-btn profile-btn--ghost profile-btn--secondary"
          disabled={isBlocked || relationshipBusy}
          title={followLabel}
          onClick={() => onToggleFollow(profile.id)}
        >
          <span className="profile-btn-label">{followLabel}</span>
        </button>
        <button
          type="button"
          className="profile-btn profile-btn--ghost profile-btn--secondary"
          disabled={isBlocked || relationshipBusy}
          title={friendLabel}
          aria-label={friendLabel}
          onClick={() => onFriendAction?.(profile.id, profile.friendshipStatus === "friends" ? "remove" : profile.friendshipStatus === "outgoing" ? "cancel" : profile.friendshipStatus === "incoming" ? "accept" : "add")}
        >
          <span className="profile-btn-label">{friendLabel}</span>
        </button>
        <button type="button" className="profile-btn profile-btn--ghost profile-btn--icon" aria-label="More profile actions" onClick={(event) => onOpenMore?.(event, profile)}>
          <AppIcon name="more" size="sm" />
        </button>
      </div>
    </div>
  );
}

export function ProfileLeftCard({
  profile,
  member,
  isCurrentUser,
  onToggleFollow,
  onMessage,
  onFriendAction,
  onEditProfile,
  onRequestVerification,
  isBlocked,
  relationshipBusy,
  onOpenMore,
}: ProfileActionButtonsProps & { member: Member }) {
  const verification = getUserVerificationSummary(member.userId, profile.verificationBadges ?? [], profile.verification ?? member.verification);
  const displayName = useProfileDisplayName(profile.id, profile.displayName);
  const username = useProfileUsername(profile.id, profile.username);
  return (
    <aside className="profile-rail" aria-label="Profile summary">
      <article className="profile-identity-card">
        <ProfileCover userId={profile.id} fallbackUrl={profile.coverUrl} label={`${displayName} cover photo`} className="profile-identity-cover" />
        <div className="profile-identity-body">
          <VerifiedProfileAvatar
            member={member}
            displayName={displayName}
            verification={verification}
            isCurrentUser={isCurrentUser}
            onEditAvatar={onEditProfile}
          />
          <div className="profile-identity-headline">
            <span className={`profile-presence-pill profile-presence-pill--${profile.status}`}>
              <i aria-hidden="true" />
              {statusLabel(profile.status)}
            </span>
            <h1 className="profile-name-with-verification"><span>{displayName}</span></h1>
            <p className="profile-handle">@{username}</p>
            {profile.statusText?.trim() ? <p className="profile-tagline">{profile.statusText.trim()}</p> : null}
          </div>
          {(() => {
            const metrics: Array<readonly [string, number]> = [
              ...(profile.privacy.showFollows
                ? [["Followers", profile.stats.followers] as const, ["Following", profile.stats.following] as const]
                : []),
              ["Posts", profile.stats.posts],
              ...(profile.privacy.showCommunities ? [["Communities", profile.stats.communities] as const] : []),
            ];
            if (!metrics.length) return null;
            return (
              <div className="profile-rail-stats" aria-label="Profile stats">
                {metrics.map(([label, value]) => (
                  <div key={label} className="profile-rail-stat">
                    <strong>{value.toLocaleString()}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <dl className="profile-identity-facts">
            <div>
              <dt>
                <AppIcon name="pin" size="xs" aria-hidden="true" />
                Location
              </dt>
              <dd>{profile.location ?? "Not shared"}</dd>
            </div>
            <div>
              <dt>
                <AppIcon name="users" size="xs" aria-hidden="true" />
                Joined
              </dt>
              <dd>{dateTimeService.formatCompactDateTime(profile.joinedAt)}</dd>
            </div>
            <div>
              <dt>
                <AppIcon name="settings" size="xs" aria-hidden="true" />
                Language
              </dt>
              <dd>{profile.preferredLanguage ?? "English"}</dd>
            </div>
          </dl>
          <ProfileActionButtons
            profile={profile}
            isCurrentUser={isCurrentUser}
            onToggleFollow={onToggleFollow}
            onMessage={onMessage}
            onFriendAction={onFriendAction}
            onEditProfile={onEditProfile}
            onRequestVerification={onRequestVerification}
            isBlocked={isBlocked}
            relationshipBusy={relationshipBusy}
            onOpenMore={onOpenMore}
          />
        </div>
      </article>
    </aside>
  );
}

export function ProfileHeroGallery({ media, onOpenImage }: { media: ProfileMediaItem[]; onOpenImage: (attachment: Attachment) => void }) {
  const visibleMedia = media.filter((item) => item.type === "image").slice(0, 8);
  const photoCount = media.filter((item) => item.type === "image").length;

  if (!photoCount) {
    return null;
  }

  return (
    <section className="profile-panel profile-gallery-panel">
      <header className="profile-panel-header profile-panel-header--compact">
        <div>
          <h2>Photos</h2>
        </div>
        <span className="profile-panel-meta">{photoCount}</span>
      </header>
      <div className="profile-gallery-strip">
        {visibleMedia.map((item) => (
          <button
            key={item.id}
            type="button"
            className="profile-gallery-tile"
            onClick={() => onOpenImage(profileMediaToAttachment(item))}
            title={item.title ?? "Profile media"}
          >
            <img src={item.thumbnailUrl ?? item.url} alt={item.title ?? "Profile media"} loading="lazy" />
          </button>
        ))}
      </div>
    </section>
  );
}

export function ProfileStats({ profile }: { profile: UserProfile; audioStats?: { radioSessions: number; podcastEpisodes: number; audioListeners: number } }) {
  const metrics: Array<readonly [string, number]> = [
    ...(profile.privacy.showFollows ? [["Followers", profile.stats.followers] as const, ["Following", profile.stats.following] as const] : []),
    ["Posts", profile.stats.posts],
    ...(profile.privacy.showCommunities ? [["Communities", profile.stats.communities] as const] : []),
  ];

  if (!metrics.length) return null;

  return (
    <section className="profile-panel profile-stats-panel" aria-label="Profile stats">
      <div className="profile-stats-strip">
        {metrics.map(([label, value]) => (
          <article key={label} className="profile-stat-item">
            <strong>{value.toLocaleString()}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ProfileBio({ profile }: { profile: UserProfile }) {
  return profile.bio.trim() ? <p className="profile-bio-copy">{profile.bio}</p> : null;
}

function ProfileOverviewSection({ profile }: { profile: UserProfile }) {
  const hasBio = Boolean(profile.bio.trim());
  if (!hasBio) return null;

  return (
    <section className="profile-panel profile-overview-panel">
      <div className="profile-overview-body">
        <div className="profile-overview-block">
          <h2 className="profile-overview-title">About</h2>
          <ProfileBio profile={profile} />
        </div>
      </div>
    </section>
  );
}

export function ProfileDetailsGrid({ profile, communities }: { profile: UserProfile; communities: Community[] }) {
  const details = ([
    { icon: "settings", label: "Timezone", value: profile.timezone ?? "Not shared" },
    { icon: "users", label: "Main community", value: profile.mainCommunityId ? getCommunityName(communities, profile.mainCommunityId) : "Not shared" },
    { icon: "lock", label: "Top role", value: profile.topRole ?? "Member" },
    { icon: "smile", label: "Activity score", value: profile.activityScore ?? 0 },
  ] satisfies Array<{ icon: IconName; label: string; value: string | number }>).filter((detail) => detail.value !== "Not shared" || detail.label === "Top role");

  if (!details.length) return null;

  return (
    <section className="profile-panel profile-details-panel">
      <header className="profile-panel-header profile-panel-header--compact">
        <h2>Workspace details</h2>
      </header>
      <dl className="profile-facts-list">
        {details.map((detail) => (
          <div key={detail.label} className="profile-facts-row">
            <dt>
              <AppIcon name={detail.icon} size="sm" aria-hidden="true" />
              {detail.label}
            </dt>
            <dd>{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ProfileSkillsTags({ profile }: { profile: UserProfile }) {
  if (!profile.tags.length) return null;

  return (
    <section className="profile-panel">
      <header className="profile-panel-header profile-panel-header--compact">
        <h2>Tags and interests</h2>
      </header>
      <div className="profile-tag-cloud">
        {profile.tags.map((tag) => (
          <span key={tag} className={`profile-tag${profile.roles.includes(tag) ? " is-role" : ""}`}>{tag}</span>
        ))}
      </div>
    </section>
  );
}

export function ProfileActivityList({
  activities,
  communities,
  onOpenActivity,
}: {
  activities: ProfileActivityItem[];
  communities: Community[];
  onOpenActivity: (activity: ProfileActivityItem) => void;
}) {
  return (
    <section className="profile-panel profile-activity-panel">
      <header className="profile-panel-header profile-panel-header--compact">
        <h2>Recent activity</h2>
        <span className="profile-panel-meta">{activities.length ? Math.min(activities.length, 8) : 0}</span>
      </header>
      <div className="profile-activity-list">
        {activities.slice(0, 8).map((activity) => {
          const canOpen = Boolean(activity.communityId && activity.channelId);
          const meta = [
            getCommunityName(communities, activity.communityId),
            activity.channelId ? `#${getChannelName(communities, activity.communityId, activity.channelId)}` : null,
            dateTimeService.formatCompactDateTime(activity.createdAt),
          ].filter(Boolean).join(" · ");
          const message = activity.preview?.trim() || activity.title;
          return (
            <article key={activity.id} className="profile-activity-item">
              <span className="profile-activity-icon" aria-hidden="true">
                <AppIcon name={getActivityIcon(activity.type)} size="sm" />
              </span>
              <div className="profile-activity-copy">
                <p className="profile-activity-message">{message}</p>
                <span className="profile-activity-context">{activity.title}</span>
                <small className="profile-activity-meta">{meta}</small>
              </div>
              {canOpen ? (
                <button type="button" className="profile-activity-open" onClick={() => onOpenActivity(activity)} aria-label={`Open ${activity.title}`}>
                  Open
                </button>
              ) : null}
            </article>
          );
        })}
        {!activities.length ? (
          <div className="profile-empty-state">
            <AppIcon name="bell" size="lg" />
            <strong>No visible recent activity</strong>
            <span>Private channels and inaccessible communities are never included.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ProfileSharedMedia({ media, onOpenImage }: { media: ProfileMediaItem[]; onOpenImage: (attachment: Attachment) => void }) {
  const imageMedia = media.filter((item) => item.type === "image").slice(0, 8);

  return (
    <section className="profile-panel">
      <header className="profile-panel-header">
        <div>
          <p className="eyebrow">Shared media</p>
          <h2>Recent images</h2>
        </div>
        <span className="profile-panel-meta">{imageMedia.length} visible</span>
      </header>
      {imageMedia.length ? (
        <div className="profile-shared-grid">
          {imageMedia.map((item) => (
            <button key={item.id} className="profile-shared-tile" type="button" onClick={() => onOpenImage(profileMediaToAttachment(item))}>
              <img src={item.thumbnailUrl ?? item.url} alt={item.title ?? "Shared media"} loading="lazy" />
              <span>{item.title ?? "Shared media"}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="profile-empty-state">
          <AppIcon name="image" size="lg" />
          <strong>No visible shared images</strong>
          <span>Private or deleted source media is not shown.</span>
        </div>
      )}
    </section>
  );
}

function ProfileRelationshipSummary({ profile, mutualCommunityCount }: { profile: UserProfile; mutualCommunityCount: number }) {
  const friendshipLabel = profile.isCurrentUser ? "Your profile" : profile.friendshipStatus === "friends" ? "Friends" : profile.friendshipStatus === "incoming" ? "Request received" : profile.friendshipStatus === "outgoing" ? "Request sent" : "Not connected";
  return (
    <section className="profile-panel">
      <header className="profile-panel-header">
        <div>
          <p className="eyebrow">Connections</p>
          <h2>Friends and follows</h2>
        </div>
      </header>
      <div className="profile-relationship-grid">
        <article><AppIcon name="users" size="sm" /><span>Relationship</span><strong>{friendshipLabel}</strong></article>
        <article><AppIcon name="home" size="sm" /><span>Mutual communities</span><strong>{mutualCommunityCount}</strong></article>
        {profile.privacy.showFollows ? (
          <>
            <article><AppIcon name="user" size="sm" /><span>Followers</span><strong>{profile.stats.followers}</strong></article>
            <article><AppIcon name="plus" size="sm" /><span>Following</span><strong>{profile.stats.following}</strong></article>
          </>
        ) : (
          <div className="profile-empty-inline">Follow counts are private.</div>
        )}
      </div>
    </section>
  );
}

function userBelongsToCommunity(community: Community, userId: string): boolean {
  if (!userId) return false;
  if (community.members.some((member) => member.userId === userId)) return true;
  // Rosters stay empty until a community is opened; owner/membership flags still prove membership.
  if (community.ownerId === userId) return true;
  if (community.currentUserMembershipUserId === userId) return true;
  return false;
}

function ProfileMutualCommunities({ profile, communities, currentUserId, onOpenCommunity }: { profile: UserProfile; communities: Community[]; currentUserId: string; onOpenCommunity?: (communityId: string) => void }) {
  const isOwnProfile = profile.id === currentUserId;
  const visible = profile.privacy.showCommunities
    ? communities.filter((community) => {
        if (!userBelongsToCommunity(community, profile.id)) return false;
        return isOwnProfile || userBelongsToCommunity(community, currentUserId);
      })
    : [];

  return (
    <section className="profile-panel profile-communities-panel">
      <header className="profile-panel-header profile-panel-header--compact">
        <h2>{isOwnProfile ? "Communities" : "Mutual communities"}</h2>
        <span className="profile-panel-meta">{visible.length}</span>
      </header>
      {visible.length ? (
        <ul className="profile-community-list">
          {visible.slice(0, 8).map((community) => {
            const roster = ensureCommunityMemberRoster(community, isOwnProfile ? {
              userId: profile.id,
              displayName: profile.displayName,
              username: profile.username,
              status: "online",
              statusText: "Online",
              roleId: community.roles.find((role) => role.systemKey === "owner" || role.name === "Owner")?.id ?? community.roles[0]?.id ?? "owner",
            } : null);
            const member = roster.find((candidate) => candidate.userId === profile.id);
            const role = community.roles.find((candidate) => candidate.id === member?.roleId);
            const roleLabel = community.ownerId === profile.id
              ? (role?.name ?? "Owner")
              : (role?.name ?? "Member");
            const markSrc = resolveCommunityMarkSrc(community);
            return (
              <li key={community.id}>
                <button type="button" className="profile-community-card" onClick={() => onOpenCommunity?.(community.id)}>
                  <span className={`profile-community-mark${markSrc ? " profile-community-mark--avatar" : ""}`} style={markSrc ? undefined : { background: community.accentColor }} aria-hidden="true">
                    {markSrc ? (
                      <img src={markSrc} alt="" draggable={false} />
                    ) : (
                      getCommunityIconLabel(community.name, community.icon)
                    )}
                  </span>
                  <span className="profile-community-copy">
                    <strong>{community.name}</strong>
                  </span>
                  <span className="profile-community-role">{roleLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="profile-empty-state">
          <AppIcon name="users" size="lg" />
          <strong>
            {profile.privacy.showCommunities
              ? (isOwnProfile ? "No communities yet" : "No mutual communities")
              : "Communities are private"}
          </strong>
          <span>
            {profile.privacy.showCommunities
              ? (isOwnProfile
                ? "Communities you create or join will show up here."
                : "Only communities visible to both accounts can appear here.")
              : "Only communities visible to both accounts can appear here."}
          </span>
        </div>
      )}
    </section>
  );
}

export function ProfileMainPanel({
  profile,
  communities,
  onOpenActivity,
  onOpenImage,
  onOpenCommunity,
  onOpenBookmarks,
  currentUserId,
  dataState = "ready",
  dataError,
  onRetryData,
}: {
  profile: UserProfile;
  communities: Community[];
  onOpenActivity: (activity: ProfileActivityItem) => void;
  onOpenImage: (attachment: Attachment) => void;
  onOpenCommunity?: (communityId: string) => void;
  onOpenBookmarks?: () => void;
  currentUserId: string;
  dataState?: "idle" | "loading" | "ready" | "error";
  dataError?: string | null;
  onRetryData?: () => void;
}) {
  const audioCatalog = useAudioCatalogState();

  if (dataState === "loading" || dataState === "idle") {
    return (
      <section className="profile-content" aria-busy="true" aria-label="Loading profile details">
        <div className="profile-panel profile-source-state">
          <span className="profile-source-state-icon"><AppIcon name="user" size="lg" /></span>
          <div>
            <p className="eyebrow">Profile</p>
            <h2>Loading visible profile sections</h2>
            <p>Picom is applying profile privacy and source-channel access.</p>
          </div>
        </div>
        <div className="profile-loading-grid" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>
    );
  }

  if (dataState === "error") {
    return (
      <section className="profile-content" aria-label="Profile loading error">
        <div className="profile-panel profile-source-state is-error" role="alert">
          <span className="profile-source-state-icon"><AppIcon name="close" size="lg" /></span>
          <div>
            <p className="eyebrow">Profile unavailable</p>
            <h2>Profile details could not be loaded</h2>
            <p>{dataError ?? "Picom could not load this access-filtered profile."}</p>
            {onRetryData ? <button type="button" className="profile-btn profile-btn--ghost" onClick={onRetryData}>Try again</button> : null}
          </div>
        </div>
      </section>
    );
  }

  if (profile.privacyRestricted) {
    return (
      <section className="profile-content" aria-label="Private profile">
        <div className="profile-empty-state profile-panel">
          <AppIcon name="lock" size="lg" />
          <strong>Limited profile</strong>
          <span>This person shares profile details only with their selected audience.</span>
        </div>
      </section>
    );
  }

  const visibleCommunityIds = new Set(communities.map((community) => community.id));
  const audioVisible = profile.privacy.showAudio && (isV1FeatureEnabled("radio") || isV1FeatureEnabled("podcasts"));
  const hostedRadio = audioVisible ? audioCatalog.snapshot.radioSessions.filter((session) => session.hostUserId === profile.id && visibleCommunityIds.has(session.communityId)) : [];
  const podcastEpisodes = audioVisible ? audioCatalog.snapshot.podcastEpisodes.filter((episode) => episode.authorUserId === profile.id && episode.status === "published" && visibleCommunityIds.has(episode.communityId)) : [];
  const savedRadio = audioVisible && profile.isCurrentUser ? audioCatalog.snapshot.radioSessions.filter((session) => session.isSavedByCurrentUser && visibleCommunityIds.has(session.communityId)) : [];
  const savedPodcasts = audioVisible && profile.isCurrentUser ? audioCatalog.snapshot.podcastEpisodes.filter((episode) => episode.isSavedByCurrentUser && episode.status === "published" && visibleCommunityIds.has(episode.communityId)) : [];
  return (
    <section className="profile-content" aria-label="Profile details">
      <ProfileOverviewSection profile={profile} />
      {profile.id === currentUserId && onOpenBookmarks ? <section className="profile-panel"><div className="profile-panel-heading"><div><p className="eyebrow">Private library</p><h2>Bookmarks</h2><p>Open the Picom items you have saved and can still access.</p></div><button type="button" className="profile-btn profile-btn--ghost" onClick={onOpenBookmarks}>Open bookmarks</button></div></section> : null}
      <ProfileMutualCommunities profile={profile} communities={communities} currentUserId={currentUserId} onOpenCommunity={onOpenCommunity} />
      <ProfileActivityList activities={profile.activities} communities={communities} onOpenActivity={onOpenActivity} />
      <ProfileHeroGallery media={profile.media} onOpenImage={onOpenImage} />
      {audioVisible ? (
        <ProfileAudioSections
          hostedRadio={hostedRadio}
          podcastEpisodes={podcastEpisodes}
          savedRadio={savedRadio}
          savedPodcasts={savedPodcasts}
          communities={communities}
          isCurrentUser={Boolean(profile.isCurrentUser)}
          loading={audioCatalog.loading}
          error={audioCatalog.error}
          onRetry={() => { void audioCatalog.refresh(); }}
          onOpenCommunity={onOpenCommunity}
        />
      ) : null}
    </section>
  );
}

export function ProfileView({
  profile,
  member,
  communities,
  currentUserId,
  onToggleFollow,
  onMessage,
  onFriendAction,
  onOpenActivity,
  onOpenImage,
  onEditProfile,
  onRequestVerification,
  isBlocked,
  relationshipBusy,
  onOpenMore,
  onOpenCommunity,
  onOpenBookmarks,
  dataState,
  dataError,
  onRetryData,
}: ProfileViewProps) {
  const isCurrentUser = profile.isCurrentUser ?? profile.id === currentUserId;

  return (
    <main className="profile-view" aria-label={`${profile.displayName} profile`}>
      <div className="profile-page-shell">
        <ProfileLeftCard
          profile={profile}
          member={member}
          isCurrentUser={isCurrentUser}
          onToggleFollow={onToggleFollow}
          onMessage={onMessage}
          onFriendAction={onFriendAction}
          onEditProfile={onEditProfile}
          onRequestVerification={onRequestVerification}
          isBlocked={isBlocked}
          relationshipBusy={relationshipBusy}
          onOpenMore={onOpenMore}
        />
        <ProfileMainPanel
          profile={profile}
          communities={communities}
          currentUserId={currentUserId}
          dataState={dataState}
          dataError={dataError}
          onRetryData={onRetryData}
          onOpenActivity={onOpenActivity}
          onOpenImage={onOpenImage}
          onOpenCommunity={onOpenCommunity}
          onOpenBookmarks={onOpenBookmarks}
        />
      </div>
    </main>
  );
}
