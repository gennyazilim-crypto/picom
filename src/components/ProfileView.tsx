import type { Attachment, Channel, Community, Member, Message } from "../types/community";
import { dateTimeService } from "../services/dateTimeService";
import { AttachmentGrid } from "./AttachmentGrid";
import { AppIcon } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";

type ProfileActivity = {
  community: Community;
  channel: Channel;
  message: Message;
};

type ProfileViewProps = {
  member: Member;
  communities: Community[];
  currentUserId: string;
  followedUserIds: string[];
  onBack: () => void;
  onToggleFollow: (userId: string) => void;
  onOpenActivity: (activity: ProfileActivity) => void;
  onOpenImage: (attachment: Attachment) => void;
};

function getRoleName(community: Community | undefined, member: Member) {
  return community?.roles.find((role) => role.id === member.roleId)?.name ?? "Member";
}

function getProfileCommunities(communities: Community[], member: Member) {
  return communities.filter((community) => community.members.some((candidate) => candidate.userId === member.userId));
}

function getChannel(community: Community, channelId: string): Channel | undefined {
  return community.categories.flatMap((category) => category.channels).find((channel) => channel.id === channelId);
}

function getActivities(communities: Community[], member: Member): ProfileActivity[] {
  return communities
    .flatMap((community) =>
      community.messages
        .filter((message) => message.authorId === member.userId)
        .map((message) => {
          const channel = getChannel(community, message.channelId);
          return channel ? { community, channel, message } : null;
        })
        .filter(Boolean),
    )
    .sort((left, right) => new Date((right as ProfileActivity).message.createdAt).getTime() - new Date((left as ProfileActivity).message.createdAt).getTime()) as ProfileActivity[];
}

function getSharedMedia(activities: ProfileActivity[]) {
  return activities.flatMap((activity) => activity.message.attachments ?? []).slice(0, 8);
}

function getSkills(member: Member, roleName: string) {
  const base = ["Desktop-first", "Community flow", "Async notes"];
  if (roleName === "Owner") return ["Workspace owner", "Product direction", ...base];
  if (roleName === "Admin") return ["Operations", "Member care", ...base];
  if (roleName === "Moderator") return ["Moderation", "Signal boost", ...base];
  return base;
}

export function ProfileView({
  member,
  communities,
  currentUserId,
  followedUserIds,
  onBack,
  onToggleFollow,
  onOpenActivity,
  onOpenImage,
}: ProfileViewProps) {
  const profileCommunities = getProfileCommunities(communities, member);
  const primaryCommunity = profileCommunities[0] ?? communities[0];
  const roleName = getRoleName(primaryCommunity, member);
  const activities = getActivities(communities, member);
  const sharedMedia = getSharedMedia(activities);
  const isCurrentUser = member.userId === currentUserId;
  const isFollowing = followedUserIds.includes(member.userId);
  const skills = getSkills(member, roleName);

  return (
    <main className="profile-view" aria-label={`${member.displayName} profile`}>
      <section className="profile-left-card">
        <button className="profile-back-button" type="button" onClick={onBack}>
          <AppIcon name="chevronRight" size="sm" />
          Back to chat
        </button>

        <div className="profile-hero-card">
          <div className="profile-hero-cover" />
          <MemberAvatar member={member} size={92} className="profile-page-avatar" />
          <h1>{member.displayName}</h1>
          <span>@{member.username}</span>
          <p>{member.bio ?? "Picom community member."}</p>
          <strong className="profile-role-badge">{roleName}</strong>
          <div className="profile-primary-actions">
            {!isCurrentUser ? (
              <button type="button" onClick={() => onToggleFollow(member.userId)}>
                {isFollowing ? "Following" : "Follow"}
              </button>
            ) : (
              <button type="button" disabled>
                Current user
              </button>
            )}
            <button type="button">Profile options</button>
          </div>
        </div>

        <div className="profile-detail-card">
          <p className="eyebrow">Details</p>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{member.statusText}</dd>
            </div>
            <div>
              <dt>Presence</dt>
              <dd>{member.status}</dd>
            </div>
            <div>
              <dt>Communities</dt>
              <dd>{profileCommunities.length}</dd>
            </div>
            <div>
              <dt>Messages</dt>
              <dd>{activities.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="profile-main-panel">
        <header className="profile-main-header">
          <div>
            <p className="eyebrow">Full profile</p>
            <h2>{member.displayName}'s workspace presence</h2>
            <span>Local MVP profile view with mock activity, shared media, and follow state.</span>
          </div>
          <div className="profile-stat-strip">
            <span><strong>{activities.length}</strong>Activities</span>
            <span><strong>{sharedMedia.length}</strong>Media</span>
            <span><strong>{profileCommunities.length}</strong>Spaces</span>
          </div>
        </header>

        <section className="profile-section">
          <div className="profile-section-header">
            <h3>Skills and tags</h3>
            <span>Mock profile signals</span>
          </div>
          <div className="profile-tag-list">
            {skills.map((skill) => <span key={skill}>{skill}</span>)}
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-section-header">
            <h3>Recent activity</h3>
            <span>Open an item to jump back into the channel.</span>
          </div>
          <div className="profile-activity-list">
            {activities.slice(0, 6).map((activity) => (
              <button key={activity.message.id} className="profile-activity-card" type="button" onClick={() => onOpenActivity(activity)}>
                <span>
                  <strong>{activity.community.name}</strong>
                  <small>#{activity.channel.name} / {dateTimeService.formatCompactDateTime(activity.message.createdAt)}</small>
                </span>
                <p>{activity.message.body}</p>
              </button>
            ))}
            {!activities.length ? (
              <div className="profile-empty-panel">
                <strong>No recent activity yet.</strong>
                <span>This member has not posted in visible mock channels.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-section-header">
            <h3>Shared media</h3>
            <span>Images from visible mock messages.</span>
          </div>
          {sharedMedia.length ? (
            <AttachmentGrid attachments={sharedMedia.slice(0, 4)} onOpenImage={onOpenImage} />
          ) : (
            <div className="profile-empty-panel">
              <strong>No shared media.</strong>
              <span>Image attachments will appear here when available.</span>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
