import type { MouseEvent } from "react";
import "./ProfileView.css";
import type { Attachment, Community, Member } from "../types/community";
import type { ProfileActivityItem, ProfileMediaItem, UserProfile } from "../types/profile";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon, type IconName } from "./AppIcon";
import { VerifiedProfileAvatar } from "./VerifiedProfileAvatar";
import { VerificationBadgeList } from "./VerificationBadgeList";
import { getUserVerificationSummary } from "../utils/verificationHelpers";
import { useAudioCatalog } from "../hooks/useAudioCatalog";
import { ProfileAudioSections } from "./audio/ProfileAudioSections";

type ProfileViewProps = {
  profile: UserProfile;
  member: Member;
  communities: Community[];
  currentUserId: string;
  onBack: () => void;
  onToggleFollow: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onFriendAction?: (userId: string) => void;
  onOpenActivity: (activity: ProfileActivityItem) => void;
  onOpenImage: (attachment: Attachment) => void;
  onPlaceholderAction?: (message: string) => void;
  onOpenMore?: (event: MouseEvent, profile: UserProfile) => void;
  onOpenCommunity?: (communityId: string) => void;
};

type ProfileActionButtonsProps = {
  profile: UserProfile;
  isCurrentUser: boolean;
  onToggleFollow: (userId: string) => void;
  onMessage?: (userId: string) => void;
  onFriendAction?: (userId: string) => void;
  onPlaceholderAction?: (message: string) => void;
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

function ProfileActionButtons({ profile, isCurrentUser, onToggleFollow, onMessage, onFriendAction, onPlaceholderAction, onOpenMore }: ProfileActionButtonsProps) {
  if (isCurrentUser) {
    return (
      <div className="profile-action-buttons">
        <button type="button" className="profile-primary-button" onClick={() => onPlaceholderAction?.("Edit profile placeholder opened locally.")}>
          <AppIcon name="edit" size="sm" />
          Edit Profile
        </button>
        <button type="button" onClick={(event) => onOpenMore?.(event, profile)}>
          <AppIcon name="more" size="sm" />
          More
        </button>
      </div>
    );
  }

  return (
    <div className="profile-action-buttons">
      <button type="button" className="profile-primary-button" onClick={() => onMessage?.(profile.id)}>
        <AppIcon name="send" size="sm" />
        Message
      </button>
      <button type="button" onClick={() => onToggleFollow(profile.id)}>
        <AppIcon name="user" size="sm" />
        {profile.isFollowing ? "Unfollow" : "Follow"}
      </button>
      <button type="button" disabled={profile.friendshipStatus === "friends" || profile.friendshipStatus === "outgoing"} onClick={() => onFriendAction?.(profile.id)}>
        <AppIcon name={profile.friendshipStatus === "friends" ? "users" : "plus"} size="sm" />
        {profile.friendshipStatus === "friends" ? "Friends" : profile.friendshipStatus === "outgoing" ? "Request sent" : profile.friendshipStatus === "incoming" ? "Review request" : "Add Friend"}
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
  onPlaceholderAction,
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
          onEditAvatar={() => onPlaceholderAction?.("Profile photo editing will use the profile service.")}
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
          onPlaceholderAction={onPlaceholderAction}
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
  const visibleMedia = media.slice(0, 5);
  const photoCount = media.filter((item) => item.type === "image").length;
  const videoCount = media.filter((item) => item.type === "video_placeholder").length;

  return (
    <section className="profile-section profile-hero-gallery-section">
      <div className="profile-section-header">
        <div>
          <p className="eyebrow">Gallery</p>
          <h2>Recent profile media</h2>
        </div>
        <span>{photoCount} photos / {videoCount} videos</span>
      </div>
      {visibleMedia.length ? (
        <div className="profile-hero-gallery">
          {visibleMedia.map((item, index) => {
            const isVideo = item.type === "video_placeholder";
            return (
              <button
                key={item.id}
                type="button"
                className={`profile-media-card ${index === 0 ? "featured" : ""} ${isVideo ? "video" : ""}`}
                onClick={() => !isVideo && onOpenImage(profileMediaToAttachment(item))}
                disabled={isVideo}
              >
                <img src={item.thumbnailUrl ?? item.url} alt={item.title ?? "Profile media"} loading="lazy" />
                <span>
                  <AppIcon name={isVideo ? "voice" : "image"} size="sm" />
                  {item.title ?? (isVideo ? "Video placeholder" : "Image")}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="profile-empty-panel">No profile media yet.</div>
      )}
    </section>
  );
}

export function ProfileStats({ profile, audioStats }: { profile: UserProfile; audioStats?: { radioSessions: number; podcastEpisodes: number; audioListeners: number } }) {
  const stats = [
    ["Communities", profile.stats.communities],
    ["Posts", profile.stats.posts],
    ["Mentions", profile.stats.mentions],
    ["Reactions", profile.stats.reactions],
    ["Followers", profile.stats.followers],
    ["Following", profile.stats.following],
    ["Roles", profile.stats.roles],
    ["Radio sessions", audioStats?.radioSessions ?? 0],
    ["Podcast episodes", audioStats?.podcastEpisodes ?? 0],
    ["Audio listeners", audioStats?.audioListeners ?? 0],
  ] as const;

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
      <p>{profile.bio}</p>
    </section>
  );
}

export function ProfileDetailsGrid({ profile, communities }: { profile: UserProfile; communities: Community[] }) {
  const details: Array<{ icon: IconName; label: string; value: string | number }> = [
    { icon: "bell", label: "Status", value: profile.statusText ?? profile.status },
    { icon: "home", label: "Location", value: profile.location ?? "Not shared" },
    { icon: "settings", label: "Timezone", value: profile.timezone ?? "System timezone" },
    { icon: "user", label: "Joined", value: dateTimeService.formatCompactDateTime(profile.joinedAt) },
    { icon: "users", label: "Main community", value: getCommunityName(communities, profile.mainCommunityId) },
    { icon: "lock", label: "Top role", value: profile.topRole ?? "Member" },
    { icon: "smile", label: "Activity score", value: profile.activityScore ?? 0 },
    { icon: "hash", label: "Language", value: profile.preferredLanguage ?? "English" },
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
        <span>Visible mock communities only</span>
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
        {!activities.length ? <div className="profile-empty-panel">No recent activity is visible for this member yet.</div> : null}
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
        <div className="profile-empty-panel">No shared images yet.</div>
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
}: {
  profile: UserProfile;
  communities: Community[];
  onOpenActivity: (activity: ProfileActivityItem) => void;
  onOpenImage: (attachment: Attachment) => void;
  onOpenCommunity?: (communityId: string) => void;
}) {
  const audioCatalog = useAudioCatalog();
  if(profile.privacyRestricted)return <section className="profile-main-panel" aria-label="Private profile"><div className="profile-section profile-empty-panel"><AppIcon name="lock" size="lg" /><strong>Limited profile</strong><p>This person shares profile details only with their selected audience.</p></div></section>;
  const visibleCommunityIds = new Set(communities.map((community) => community.id));
  const hostedRadio = audioCatalog.radioSessions.filter((session) => session.hostUserId === profile.id && visibleCommunityIds.has(session.communityId));
  const podcastEpisodes = audioCatalog.podcastEpisodes.filter((episode) => episode.authorUserId === profile.id && episode.status === "published" && visibleCommunityIds.has(episode.communityId));
  const savedRadio = audioCatalog.radioSessions.filter((session) => session.isSavedByCurrentUser && visibleCommunityIds.has(session.communityId));
  const savedPodcasts = audioCatalog.podcastEpisodes.filter((episode) => episode.isSavedByCurrentUser && episode.status === "published" && visibleCommunityIds.has(episode.communityId));
  const audioStats = { radioSessions: hostedRadio.length, podcastEpisodes: podcastEpisodes.length, audioListeners: [...hostedRadio, ...podcastEpisodes].reduce((total, item) => total + item.listenerCount, 0) };
  return (
    <section className="profile-main-panel" aria-label="Profile details">
      <ProfileHeroGallery media={profile.media} onOpenImage={onOpenImage} />
      <ProfileStats profile={profile} audioStats={audioStats} />
      <ProfileBio profile={profile} />
      <ProfileDetailsGrid profile={profile} communities={communities} />
      <ProfileSkillsTags profile={profile} />
      <ProfileActivityList activities={profile.activities} communities={communities} onOpenActivity={onOpenActivity} />
      <ProfileSharedMedia media={profile.media} onOpenImage={onOpenImage} />
      <ProfileAudioSections hostedRadio={hostedRadio} podcastEpisodes={podcastEpisodes} savedRadio={savedRadio} savedPodcasts={savedPodcasts} communities={communities} isCurrentUser={Boolean(profile.isCurrentUser)} onOpenCommunity={onOpenCommunity} />
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
  onPlaceholderAction,
  onOpenMore,
  onOpenCommunity,
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
          onPlaceholderAction={onPlaceholderAction}
          onOpenMore={onOpenMore}
        />
        <ProfileMainPanel profile={profile} communities={communities} onOpenActivity={onOpenActivity} onOpenImage={onOpenImage} onOpenCommunity={onOpenCommunity} />
      </div>
    </main>
  );
}
