import type { MouseEvent } from "react";
import "./ProfileView.css";
import type { Attachment, Community, Member } from "../types/community";
import type { ProfileActivityItem, ProfileMediaItem, UserProfile } from "../types/profile";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon, type IconName } from "./AppIcon";
import { VerifiedProfileAvatar } from "./VerifiedProfileAvatar";
import { VerificationBadgeList } from "./VerificationBadgeList";
import { getUserVerificationSummary } from "../utils/verificationHelpers";
import { useAudioCatalogState } from "../hooks/useAudioCatalog";
import { ProfileAudioSections } from "./audio/ProfileAudioSections";

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

function ProfileActionButtons({ profile, isCurrentUser, onToggleFollow, onMessage, onFriendAction, onEditProfile, onRequestVerification, isBlocked = false, relationshipBusy = false, onOpenMore }: ProfileActionButtonsProps) {
  if (isCurrentUser) {
    return (
      <div className="profile-action-buttons">
        {onEditProfile ? <button type="button" className="profile-primary-button" onClick={onEditProfile}>
          <AppIcon name="edit" size="sm" />
          Edit Profile
        </button> : null}
        {onRequestVerification ? <button type="button" onClick={onRequestVerification}>
          <AppIcon name="lock" size="sm" />
          Verification
        </button> : null}
        <button type="button" onClick={(event) => onOpenMore?.(event, profile)}>
          <AppIcon name="more" size="sm" />
          More
        </button>
      </div>
    );
  }

  return (
    <div className="profile-action-buttons">
      <button type="button" className="profile-primary-button" disabled={isBlocked || relationshipBusy} onClick={() => onMessage?.(profile.id)}>
        <AppIcon name="send" size="sm" />
        Message
      </button>
      <button type="button" disabled={isBlocked || relationshipBusy} onClick={() => onToggleFollow(profile.id)}>
        <AppIcon name="user" size="sm" />
        {profile.isFollowing ? "Unfollow" : "Follow"}
      </button>
      <button type="button" disabled={isBlocked || relationshipBusy} onClick={() => onFriendAction?.(profile.id, profile.friendshipStatus === "friends" ? "remove" : profile.friendshipStatus === "outgoing" ? "cancel" : profile.friendshipStatus === "incoming" ? "accept" : "add")}>
        <AppIcon name={profile.friendshipStatus === "friends" ? "users" : profile.friendshipStatus === "outgoing" ? "close" : profile.friendshipStatus === "incoming" ? "users" : "plus"} size="sm" />
        {relationshipBusy ? "Updating..." : profile.friendshipStatus === "friends" ? "Remove friend" : profile.friendshipStatus === "outgoing" ? "Cancel request" : profile.friendshipStatus === "incoming" ? "Accept request" : "Add Friend"}
      </button>
      <button type="button" aria-label="More profile actions" onClick={(event) => onOpenMore?.(event, profile)}>
        <AppIcon name="more" size="sm" />
      </button>
    </div>
  );
}

export function ProfileLeftCard({
  profile,
  member,
  isCurrentUser,
  onBack,
  onToggleFollow,
  onMessage,
  onFriendAction,
  onEditProfile,
  onRequestVerification,
  isBlocked,
  relationshipBusy,
  onOpenMore,
}: ProfileActionButtonsProps & { member: Member; onBack: () => void }) {
  const verification = getUserVerificationSummary(member.userId, profile.verificationBadges ?? [], profile.verification ?? member.verification);
  return (
    <aside className="profile-left-card" aria-label="Profile summary">
      <button className="profile-back-button" type="button" onClick={onBack}>
        <AppIcon name="chevronRight" size="sm" />
        Back
      </button>

      <div className="profile-portrait-panel">
        <div className="profile-cover-art" style={{ backgroundImage: `url(${profile.coverUrl})` }} />
        <VerifiedProfileAvatar
          member={member}
          displayName={profile.displayName}
          verification={verification}
          isCurrentUser={isCurrentUser}
          onEditAvatar={onEditProfile}
        />
        <span className={`profile-status-chip ${profile.status}`}>{profile.status}</span>
        <h1 className="profile-name-with-verification"><span>{profile.displayName}</span></h1>
        <p>@{profile.username}</p>
        <span className="profile-status-text">{profile.statusText ?? "Picom member"}</span>
        <div className="profile-role-row">
          {profile.roles.slice(0, 3).map((role) => (
            <strong key={role}>{role}</strong>
          ))}
        </div>
        <VerificationBadgeList badges={profile.verificationBadges ?? []} />
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

      <section className="profile-side-card">
        <p className="eyebrow">Availability</p>
        <div className="profile-availability-card">
          <span className={`status-dot ${member.status}`} />
          <div>
            <strong>{profile.status === "busy" ? "Busy" : profile.status}</strong>
            <small>{profile.statusText ?? "No status message"}</small>
          </div>
        </div>
      </section>

      <section className="profile-side-card">
        <p className="eyebrow">Quick details</p>
        <dl className="profile-side-details">
          <div>
            <dt>Location</dt>
            <dd>{profile.location ?? "Not shared"}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{dateTimeService.formatCompactDateTime(profile.joinedAt)}</dd>
          </div>
          <div>
            <dt>Language</dt>
            <dd>{profile.preferredLanguage ?? "English"}</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}

export function ProfileHeroGallery({ media, onOpenImage }: { media: ProfileMediaItem[]; onOpenImage: (attachment: Attachment) => void }) {
  const visibleMedia = media.filter((item) => item.type === "image").slice(0, 5);
  const photoCount = media.filter((item) => item.type === "image").length;

  return (
    <section className="profile-section profile-hero-gallery-section">
      <div className="profile-section-header">
        <div>
          <p className="eyebrow">Gallery</p>
          <h2>Recent profile media</h2>
        </div>
        <span>{photoCount} photos</span>
      </div>
      {visibleMedia.length ? (
        <div className="profile-hero-gallery">
          {visibleMedia.map((item, index) => {
            return (
              <button
                key={item.id}
                type="button"
                className={`profile-media-card ${index === 0 ? "featured" : ""}`}
                onClick={() => onOpenImage(profileMediaToAttachment(item))}
              >
                <img src={item.thumbnailUrl ?? item.url} alt={item.title ?? "Profile media"} loading="lazy" />
                <span>
                  <AppIcon name="image" size="sm" />
                  {item.title ?? "Image"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="profile-empty-panel"><AppIcon name="image" size="lg" /><strong>No profile media yet</strong><span>Visible images shared by this member will appear here.</span></div>
      )}
    </section>
  );
}

export function ProfileStats({ profile, audioStats }: { profile: UserProfile; audioStats?: { radioSessions: number; podcastEpisodes: number; audioListeners: number } }) {
  const stats: Array<readonly [string, number]> = [
    ...(profile.privacy.showCommunities ? [["Communities", profile.stats.communities] as const] : []),
    ["Posts", profile.stats.posts],
    ["Mentions", profile.stats.mentions],
    ["Reactions", profile.stats.reactions],
    ...(profile.privacy.showFollows ? [["Followers", profile.stats.followers] as const, ["Following", profile.stats.following] as const] : []),
    ...(profile.privacy.showCommunities ? [["Roles", profile.stats.roles] as const] : []),
    ...(audioStats ? [["Radio sessions", audioStats.radioSessions] as const, ["Podcast episodes", audioStats.podcastEpisodes] as const, ["Audio listeners", audioStats.audioListeners] as const] : []),
  ];

  return (
    <section className="profile-stats-grid" aria-label="Profile stats">
      {stats.map(([label, value]) => (
        <div key={label} className="profile-stat-card">
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}

export function ProfileBio({ profile }: { profile: UserProfile }) {
  return (
    <section className="profile-section profile-bio-card">
      <div className="profile-section-header">
        <div>
          <p className="eyebrow">Bio</p>
          <h2>About {profile.displayName}</h2>
        </div>
      </div>
      {profile.bio.trim() ? <p>{profile.bio}</p> : <div className="profile-empty-inline">No bio has been shared.</div>}
    </section>
  );
}

export function ProfileDetailsGrid({ profile, communities }: { profile: UserProfile; communities: Community[] }) {
  const details: Array<{ icon: IconName; label: string; value: string | number }> = [
    { icon: "bell", label: "Status", value: profile.statusText ?? profile.status },
    { icon: "home", label: "Location", value: profile.location ?? "Not shared" },
    { icon: "settings", label: "Timezone", value: profile.timezone ?? "Not shared" },
    { icon: "user", label: "Joined", value: dateTimeService.formatCompactDateTime(profile.joinedAt) },
    { icon: "users", label: "Main community", value: profile.mainCommunityId ? getCommunityName(communities, profile.mainCommunityId) : "Not shared" },
    { icon: "lock", label: "Top role", value: profile.topRole ?? "Member" },
    { icon: "smile", label: "Activity score", value: profile.activityScore ?? 0 },
    { icon: "hash", label: "Language", value: profile.preferredLanguage ?? "Not shared" },
  ];

  return (
    <section className="profile-section">
      <div className="profile-section-header">
        <div>
          <p className="eyebrow">Details</p>
          <h2>Workspace profile</h2>
        </div>
      </div>
      <div className="profile-details-grid">
        {details.map((detail) => (
          <div key={detail.label} className="profile-detail-item">
            <AppIcon name={detail.icon} size="sm" />
            <span>{detail.label}</span>
            <strong>{detail.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProfileSkillsTags({ profile }: { profile: UserProfile }) {
  return (
    <section className="profile-section">
      <div className="profile-section-header">
        <div>
          <p className="eyebrow">Skills</p>
          <h2>Tags and interests</h2>
        </div>
      </div>
      <div className="profile-skills-tags">
        {profile.tags.map((tag) => (
          <span key={tag} className={profile.roles.includes(tag) ? "role-tag" : undefined}>{tag}</span>
        ))}
        {!profile.tags.length ? <div className="profile-empty-inline">No tags or interests shared.</div> : null}
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
    <section className="profile-section">
      <div className="profile-section-header">
        <div>
          <p className="eyebrow">Activity</p>
          <h2>Recent activity</h2>
        </div>
        <span>Access-filtered sources only</span>
      </div>
      <div className="profile-activity-list">
        {activities.slice(0, 8).map((activity) => (
          <article key={activity.id} className="profile-activity-card">
            <div className="profile-activity-icon">
              <AppIcon name={getActivityIcon(activity.type)} size="sm" />
            </div>
            <div>
              <strong>{activity.title}</strong>
              <p>{activity.preview}</p>
              <small>
                {getCommunityName(communities, activity.communityId)} / #{getChannelName(communities, activity.communityId, activity.channelId)} / {dateTimeService.formatCompactDateTime(activity.createdAt)}
              </small>
            </div>
            {activity.communityId && activity.channelId ? (
              <button type="button" onClick={() => onOpenActivity(activity)}>
                Open in channel
              </button>
            ) : null}
          </article>
        ))}
        {!activities.length ? <div className="profile-empty-panel"><AppIcon name="bell" size="lg" /><strong>No visible recent activity</strong><span>Private channels and inaccessible communities are never included.</span></div> : null}
      </div>
    </section>
  );
}

export function ProfileSharedMedia({ media, onOpenImage }: { media: ProfileMediaItem[]; onOpenImage: (attachment: Attachment) => void }) {
  const imageMedia = media.filter((item) => item.type === "image").slice(0, 8);

  return (
    <section className="profile-section">
      <div className="profile-section-header">
        <div>
          <p className="eyebrow">Shared media</p>
          <h2>Recent images</h2>
        </div>
        <span>{imageMedia.length} visible</span>
      </div>
      {imageMedia.length ? (
        <div className="profile-shared-media-grid">
          {imageMedia.map((item) => (
            <button key={item.id} className="profile-shared-media-card" type="button" onClick={() => onOpenImage(profileMediaToAttachment(item))}>
              <img src={item.thumbnailUrl ?? item.url} alt={item.title ?? "Shared media"} loading="lazy" />
              <span>{item.title ?? "Shared media"}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="profile-empty-panel"><AppIcon name="image" size="lg" /><strong>No visible shared images</strong><span>Private or deleted source media is not shown.</span></div>
      )}
    </section>
  );
}

function ProfileRelationshipSummary({ profile, mutualCommunityCount }: { profile: UserProfile; mutualCommunityCount: number }) {
  const friendshipLabel = profile.isCurrentUser ? "Your profile" : profile.friendshipStatus === "friends" ? "Friends" : profile.friendshipStatus === "incoming" ? "Request received" : profile.friendshipStatus === "outgoing" ? "Request sent" : "Not connected";
  return <section className="profile-section"><div className="profile-section-header"><div><p className="eyebrow">Connections</p><h2>Friends and follows</h2></div></div><div className="profile-relationship-grid"><div><AppIcon name="users" size="sm" /><span>Relationship</span><strong>{friendshipLabel}</strong></div><div><AppIcon name="home" size="sm" /><span>Mutual communities</span><strong>{mutualCommunityCount}</strong></div>{profile.privacy.showFollows ? <><div><AppIcon name="user" size="sm" /><span>Followers</span><strong>{profile.stats.followers}</strong></div><div><AppIcon name="plus" size="sm" /><span>Following</span><strong>{profile.stats.following}</strong></div></> : <div className="profile-empty-inline">Follow counts are private.</div>}</div></section>;
}

function ProfileMutualCommunities({ profile, communities, currentUserId, onOpenCommunity }: { profile: UserProfile; communities: Community[]; currentUserId: string; onOpenCommunity?: (communityId: string) => void }) {
  const visible = profile.privacy.showCommunities ? communities.filter((community) => community.members.some((member) => member.userId === profile.id) && (profile.id === currentUserId || community.members.some((member) => member.userId === currentUserId))) : [];
  return <section className="profile-section"><div className="profile-section-header"><div><p className="eyebrow">Communities</p><h2>{profile.id === currentUserId ? "Joined communities" : "Mutual communities"}</h2></div><span>{visible.length} visible</span></div>{visible.length ? <div className="profile-mutual-community-list">{visible.slice(0, 8).map((community) => { const member = community.members.find((candidate) => candidate.userId === profile.id); const role = community.roles.find((candidate) => candidate.id === member?.roleId); return <button type="button" key={community.id} onClick={() => onOpenCommunity?.(community.id)}><span className="profile-mutual-community-icon" style={{ background: community.accentColor }}>{community.icon}</span><span><strong>{community.name}</strong><small>{role?.name ?? "Member"}</small></span><AppIcon name="chevronRight" size="sm" /></button>; })}</div> : <div className="profile-empty-panel"><AppIcon name="users" size="lg" /><strong>{profile.privacy.showCommunities ? "No mutual communities" : "Communities are private"}</strong><span>Only communities visible to both accounts can appear here.</span></div>}</section>;
}

export function ProfileMainPanel({
  profile,
  communities,
  onOpenActivity,
  onOpenImage,
  onOpenCommunity,
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
  currentUserId: string;
  dataState?: "idle" | "loading" | "ready" | "error";
  dataError?: string | null;
  onRetryData?: () => void;
}) {
  const audioCatalog = useAudioCatalogState();
  if (dataState === "loading" || dataState === "idle") return <section className="profile-main-panel" aria-busy="true" aria-label="Loading profile details"><div className="profile-section profile-source-state"><span className="profile-source-state-icon"><AppIcon name="user" size="lg" /></span><div><p className="eyebrow">Profile</p><h2>Loading visible profile sections</h2><p>Picom is applying profile privacy and source-channel access.</p></div></div><div className="profile-loading-grid" aria-hidden="true"><i /><i /><i /><i /></div></section>;
  if (dataState === "error") return <section className="profile-main-panel" aria-label="Profile loading error"><div className="profile-section profile-source-state error" role="alert"><span className="profile-source-state-icon"><AppIcon name="close" size="lg" /></span><div><p className="eyebrow">Profile unavailable</p><h2>Profile details could not be loaded</h2><p>{dataError ?? "Picom could not load this access-filtered profile."}</p>{onRetryData ? <button type="button" onClick={onRetryData}>Try again</button> : null}</div></div></section>;
  if(profile.privacyRestricted)return <section className="profile-main-panel" aria-label="Private profile"><div className="profile-section profile-empty-panel"><AppIcon name="lock" size="lg" /><strong>Limited profile</strong><p>This person shares profile details only with their selected audience.</p></div></section>;
  const visibleCommunityIds = new Set(communities.map((community) => community.id));
  const audioVisible = profile.privacy.showAudio;
  const hostedRadio = audioVisible ? audioCatalog.snapshot.radioSessions.filter((session) => session.hostUserId === profile.id && visibleCommunityIds.has(session.communityId)) : [];
  const podcastEpisodes = audioVisible ? audioCatalog.snapshot.podcastEpisodes.filter((episode) => episode.authorUserId === profile.id && episode.status === "published" && visibleCommunityIds.has(episode.communityId)) : [];
  const savedRadio = audioVisible && profile.isCurrentUser ? audioCatalog.snapshot.radioSessions.filter((session) => session.isSavedByCurrentUser && visibleCommunityIds.has(session.communityId)) : [];
  const savedPodcasts = audioVisible && profile.isCurrentUser ? audioCatalog.snapshot.podcastEpisodes.filter((episode) => episode.isSavedByCurrentUser && episode.status === "published" && visibleCommunityIds.has(episode.communityId)) : [];
  const audioStats = { radioSessions: hostedRadio.length, podcastEpisodes: podcastEpisodes.length, audioListeners: [...hostedRadio, ...podcastEpisodes].reduce((total, item) => total + item.listenerCount, 0) };
  const mutualCommunityCount = communities.filter((community) => community.members.some((member) => member.userId === profile.id) && (profile.id === currentUserId || community.members.some((member) => member.userId === currentUserId))).length;
  return (
    <section className="profile-main-panel" aria-label="Profile details">
      <ProfileHeroGallery media={profile.media} onOpenImage={onOpenImage} />
      <ProfileStats profile={profile} audioStats={audioVisible && !audioCatalog.loading && !audioCatalog.error ? audioStats : undefined} />
      <ProfileBio profile={profile} />
      <ProfileDetailsGrid profile={profile} communities={communities} />
      <ProfileSkillsTags profile={profile} />
      <ProfileRelationshipSummary profile={profile} mutualCommunityCount={mutualCommunityCount} />
      <ProfileMutualCommunities profile={profile} communities={communities} currentUserId={currentUserId} onOpenCommunity={onOpenCommunity} />
      <ProfileActivityList activities={profile.activities} communities={communities} onOpenActivity={onOpenActivity} />
      <ProfileSharedMedia media={profile.media} onOpenImage={onOpenImage} />
      {audioVisible ? <ProfileAudioSections hostedRadio={hostedRadio} podcastEpisodes={podcastEpisodes} savedRadio={savedRadio} savedPodcasts={savedPodcasts} communities={communities} isCurrentUser={Boolean(profile.isCurrentUser)} loading={audioCatalog.loading} error={audioCatalog.error} onRetry={() => { void audioCatalog.refresh(); }} onOpenCommunity={onOpenCommunity} /> : null}
    </section>
  );
}

export function ProfileView({
  profile,
  member,
  communities,
  currentUserId,
  onBack,
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
          onBack={onBack}
          onToggleFollow={onToggleFollow}
          onMessage={onMessage}
          onFriendAction={onFriendAction}
          onEditProfile={onEditProfile}
          onRequestVerification={onRequestVerification}
          isBlocked={isBlocked}
          relationshipBusy={relationshipBusy}
          onOpenMore={onOpenMore}
        />
        <ProfileMainPanel profile={profile} communities={communities} currentUserId={currentUserId} dataState={dataState} dataError={dataError} onRetryData={onRetryData} onOpenActivity={onOpenActivity} onOpenImage={onOpenImage} onOpenCommunity={onOpenCommunity} />
      </div>
    </main>
  );
}
