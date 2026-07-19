import { lazy, Suspense, useMemo, useRef, type MouseEvent } from "react";
import { motion, useReducedMotion, type Variants } from "../utils/motionLite";
import type { Community, Member } from "../types/community";
import type { FollowedUserStory } from "../types/stories";
import { avatarService } from "../services/avatarService";
import { AppIcon } from "./AppIcon";
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

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 460, damping: 32, mass: 0.7 },
  },
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

function dedupeStoriesByAuthor(stories: FollowedUserStory[]) {
  const seenAuthors = new Set<string>();
  const uniqueStories: FollowedUserStory[] = [];
  for (const story of stories) {
    if (seenAuthors.has(story.authorId)) continue;
    seenAuthors.add(story.authorId);
    uniqueStories.push(story);
  }
  return uniqueStories;
}

export function StoryCard({
  story,
  author,
  onOpenStory,
  reduceMotion = false,
}: {
  story: FollowedUserStory;
  author: Member;
  onOpenStory: (storyId: string) => void;
  reduceMotion?: boolean;
}) {
  const isUnseen = story.status === "unseen";
  const avatarUrl = avatarService.getAvatarForMember(author);
  const coverUrl = story.imageUrl ?? avatarUrl;
  const usesGradient = !coverUrl;

  return (
    <motion.button
      className={`story-card ${isUnseen ? "unseen" : "seen"}${usesGradient ? ` ${story.gradient ?? "story-bg-ocean"}` : ""}`}
      type="button"
      aria-label={`Open story by ${author.displayName}`}
      variants={reduceMotion ? undefined : cardVariants}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      onClick={() => onOpenStory(story.id)}
    >
      {coverUrl ? (
        <span
          className={`story-card-media${story.imageUrl ? "" : " is-avatar-fallback"}`}
          style={{ backgroundImage: `url("${coverUrl}")` }}
          aria-hidden="true"
        />
      ) : null}
      <span className="story-card-scrim" aria-hidden="true" />
      <span className={`story-card-avatar${isUnseen ? " is-unseen" : ""}`}>
        <MemberAvatar member={author} size={26} />
      </span>
      <span className="story-card-name">{author.displayName}</span>
    </motion.button>
  );
}

export function StoryCardGrid({
  stories,
  communities,
  onOpenStory,
}: {
  stories: FollowedUserStory[];
  communities: Community[];
  onOpenStory: (storyId: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const carouselStories = useMemo(() => dedupeStoriesByAuthor(stories), [stories]);

  const scrollCarousel = (direction: -1 | 1) => {
    const grid = gridRef.current;
    if (!grid) return;
    const step = Math.max(180, Math.round(grid.clientWidth * 0.72));
    grid.scrollBy({ left: direction * step, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <div className="story-card-grid-shell">
      <button
        type="button"
        className="story-card-nav story-card-nav--prev"
        aria-label="Scroll stories left"
        onClick={() => scrollCarousel(-1)}
      >
        <AppIcon name="chevronRight" size={14} className="story-card-nav-icon story-card-nav-icon--left" />
      </button>
      <motion.div
        ref={gridRef}
        className="story-card-grid"
        aria-label="Followed people stories"
        variants={reduceMotion ? undefined : gridVariants}
        initial={reduceMotion ? false : "hidden"}
        animate={reduceMotion ? undefined : "visible"}
      >
        {carouselStories.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            author={getStoryAuthor(communities, story)}
            onOpenStory={onOpenStory}
            reduceMotion={reduceMotion ?? false}
          />
        ))}
      </motion.div>
      <button
        type="button"
        className="story-card-nav story-card-nav--next"
        aria-label="Scroll stories right"
        onClick={() => scrollCarousel(1)}
      >
        <AppIcon name="chevronRight" size={14} className="story-card-nav-icon" />
      </button>
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
  const unseenCount = useMemo(() => stories.filter((story) => story.status === "unseen").length, [stories]);

  return (
    <section className="followed-stories-header" aria-label="Following stories">
      <div className="followed-stories-heading">
        <h1>Hikayeler</h1>
        {unseenCount > 0 ? (
          <span className="followed-stories-count" aria-label={`${unseenCount} new stories`}>
            {unseenCount} yeni
          </span>
        ) : null}
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
