import { lazy, Suspense, type MouseEvent } from "react";
import type { Community, Member } from "../types/community";
import type { FollowedUserStory } from "../types/stories";
import { MemberAvatar } from "./MemberAvatar";

const StoryViewerModal = lazy(() => import("./StoryViewerModal").then((module) => ({ default: module.StoryViewerModal })));

type FollowedPeopleStoriesHeaderProps = {
  stories: FollowedUserStory[];
  communities: Community[];
  activeStoryId: string | null;
  onOpenStory: (storyId: string) => void;
  onCloseStory: () => void;
  onPreviousStory: () => void;
  onNextStory: () => void;
  onOpenStoryProfile: (event: MouseEvent, member: Member) => void;
  onOpenStoryInChannel: (story: FollowedUserStory) => void;
};

function findMember(communities: Community[], userId: string) {
  return communities.flatMap((community) => community.members).find((member) => member.userId === userId);
}

function getStoryAuthor(communities: Community[], story: FollowedUserStory): Member {
  return findMember(communities, story.authorId) ?? {
    id: `story-author-${story.authorId}`,
    userId: story.authorId,
    displayName: "Picom member",
    username: story.authorId,
    avatarSeed: story.authorId,
    status: "online",
    statusText: "Following",
    roleId: "member",
  };
}

export function StoryCard({ story, author, onOpenStory }: { story: FollowedUserStory; author: Member; onOpenStory: (storyId: string) => void }) {
  return (
    <button
      className={`story-card ${story.status === "unseen" ? "unseen" : "seen"} ${story.gradient ?? "story-bg-ocean"}`}
      type="button"
      aria-label={`Open story by ${author.displayName}: ${story.title}`}
      onClick={() => onOpenStory(story.id)}
    >
      <span className="story-card-art" aria-hidden="true">
        <i className="story-blob one" />
        <i className="story-blob two" />
        <i className="story-line" />
      </span>
      <span className="story-user-pill">
        <MemberAvatar member={author} size={20} />
        <span>
          <strong>{author.displayName}</strong>
          <small>@{author.username}</small>
        </span>
      </span>
      <span className="story-time-badge">{story.timeLabel}</span>
      <span className="story-bottom-overlay">
        <small>{story.subtitle ?? story.type.replace("_", " ")}</small>
        <strong>{story.title}</strong>
      </span>
    </button>
  );
}

export function StoryCardGrid({ stories, communities, onOpenStory }: { stories: FollowedUserStory[]; communities: Community[]; onOpenStory: (storyId: string) => void }) {
  return (
    <div className="story-card-grid" aria-label="Followed people stories">
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} author={getStoryAuthor(communities, story)} onOpenStory={onOpenStory} />
      ))}
    </div>
  );
}

export function FollowedPeopleStoriesHeader({
  stories,
  communities,
  activeStoryId,
  onOpenStory,
  onCloseStory,
  onPreviousStory,
  onNextStory,
  onOpenStoryProfile,
  onOpenStoryInChannel,
}: FollowedPeopleStoriesHeaderProps) {
  const activeStory = stories.find((story) => story.id === activeStoryId) ?? null;
  const activeAuthor = activeStory ? getStoryAuthor(communities, activeStory) : null;

  return (
    <section className="followed-stories-header" aria-label="Following stories">
      <div className="followed-stories-heading">
        <div>
          <p className="eyebrow">Following Stories</p>
          <h1>Takip Ettiklerin</h1>
        </div>
        <span>Updates from people you follow</span>
      </div>
      <StoryCardGrid stories={stories} communities={communities} onOpenStory={onOpenStory} />
      {activeStory && activeAuthor ? (
        <Suspense fallback={<div className="story-viewer-backdrop" role="status"><div className="story-viewer-modal empty-state compact">Opening story...</div></div>}>
        <StoryViewerModal
          story={activeStory}
          stories={stories}
          author={activeAuthor}
          communities={communities}
          onCloseStory={onCloseStory}
          onPreviousStory={onPreviousStory}
          onNextStory={onNextStory}
          onOpenStoryProfile={onOpenStoryProfile}
          onOpenStoryInChannel={onOpenStoryInChannel}
        />
        </Suspense>
      ) : null}
    </section>
  );
}
