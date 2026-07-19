import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { emojiCategoryLabels, emojiOptions, type EmojiCategoryId } from "../data/emojiOptions";
import { customEmojiService } from "../services/customEmojiService";
import { emojiRecentService } from "../services/emojiRecentService";
import { AppIcon } from "./AppIcon";

type EmojiPickerProps = {
  label: string;
  className?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  communityId?: string;
  mode?: "composer" | "reaction";
};

const categoryOrder: EmojiCategoryId[] = ["frequent", "smileys", "gestures", "objects", "symbols"];
const GRID_COLUMNS = 8;
const QUICK_REACTION_LIMIT = 6;

export function EmojiPicker({ label, className, onSelect, onClose, communityId, mode = "composer" }: EmojiPickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryId>("frequent");
  const [recentEmojis, setRecentEmojis] = useState(() => emojiRecentService.list());
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [reactionExpanded, setReactionExpanded] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const emojiButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isReaction = mode === "reaction";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && pickerRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!isReaction || reactionExpanded) searchRef.current?.focus();
  }, [isReaction, reactionExpanded]);

  const quickReactionEmojis = useMemo(() => {
    const frequent = emojiOptions.filter((option) => option.category === "frequent").map((option) => option.emoji);
    const recent = recentEmojis.map((recent) => recent.emoji);
    return [...new Set([...recent, ...frequent])].slice(0, QUICK_REACTION_LIMIT);
  }, [recentEmojis]);

  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (isReaction) {
      if (!normalized) return emojiOptions;
      return emojiOptions.filter((option) => option.label.includes(normalized) || option.emoji.includes(normalized));
    }

    if (!normalized && activeCategory === "frequent") {
      const resolvedRecent = recentEmojis
        .map((recent) => emojiOptions.find((option) => option.emoji === recent.emoji) ?? { ...recent, category: "frequent" as const })
        .filter((option, index, items) => items.findIndex((candidate) => candidate.emoji === option.emoji) === index);
      if (resolvedRecent.length) return resolvedRecent;
    }

    return emojiOptions.filter((option) => {
      if (normalized) return option.label.includes(normalized) || option.emoji.includes(normalized);
      return option.category === activeCategory;
    });
  }, [activeCategory, isReaction, query, recentEmojis]);

  const communityEmojis = useMemo(
    () => communityId
      ? customEmojiService.list(communityId).filter((emoji) => !query.trim() || emoji.name.includes(query.trim().toLowerCase()))
      : [],
    [communityId, query],
  );

  useEffect(() => {
    emojiButtonRefs.current = [];
    setFocusedIndex(0);
  }, [activeCategory, query, visibleOptions.length, reactionExpanded]);

  const selectEmoji = (emoji: string, optionLabel: string, persist = true) => {
    if (persist) setRecentEmojis(emojiRecentService.record(emoji, optionLabel));
    onSelect(emoji);
  };

  const focusEmoji = (index: number) => {
    if (!visibleOptions.length) return;
    const nextIndex = Math.max(0, Math.min(visibleOptions.length - 1, index));
    setFocusedIndex(nextIndex);
    emojiButtonRefs.current[nextIndex]?.focus();
  };

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const movement = event.key === "ArrowRight" ? 1
      : event.key === "ArrowLeft" ? -1
        : event.key === "ArrowDown" ? GRID_COLUMNS
          : event.key === "ArrowUp" ? -GRID_COLUMNS
            : 0;
    if (movement) {
      event.preventDefault();
      focusEmoji(focusedIndex + movement);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusEmoji(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusEmoji(visibleOptions.length - 1);
    }
  };

  const onCategoryKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, categoryIndex: number) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? categoryOrder.length - 1
        : (categoryIndex + (event.key === "ArrowRight" ? 1 : -1) + categoryOrder.length) % categoryOrder.length;
    const nextCategory = categoryOrder[nextIndex];
    setQuery("");
    setActiveCategory(nextCategory);
    pickerRef.current?.querySelector<HTMLButtonElement>(`[data-emoji-category="${nextCategory}"]`)?.focus();
  };

  const renderEmojiGrid = (options: typeof visibleOptions, gridClassName = "") => (
    <div className={`emoji-picker-grid ${gridClassName}`.trim()} role="listbox" aria-label={query ? "Search results" : isReaction ? "All reactions" : emojiCategoryLabels[activeCategory]} onKeyDown={onGridKeyDown}>
      {options.map((option, index) => (
        <button
          key={`${option.category}-${option.label}-${option.emoji}`}
          ref={(node) => { emojiButtonRefs.current[index] = node; }}
          type="button"
          role="option"
          aria-selected={focusedIndex === index}
          tabIndex={focusedIndex === index ? 0 : -1}
          aria-label={option.label}
          title={option.label}
          onFocus={() => setFocusedIndex(index)}
          onClick={() => selectEmoji(option.emoji, option.label)}
        >
          {option.emoji}
        </button>
      ))}
    </div>
  );

  if (isReaction && !reactionExpanded) {
    return (
      <div ref={pickerRef} className={`emoji-picker emoji-picker--reaction-quick ${className ?? ""}`.trim()} role="dialog" aria-label={label} data-mode={mode}>
        <div className="emoji-picker-quick-row" role="toolbar" aria-label="Quick reactions">
          {quickReactionEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="emoji-picker-quick-item"
              aria-label={`React with ${emoji}`}
              onClick={() => selectEmoji(emoji, emoji)}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className="emoji-picker-quick-more"
            aria-label="More emojis"
            onClick={() => setReactionExpanded(true)}
          >
            <AppIcon name="smile" size="sm" />
          </button>
        </div>
      </div>
    );
  }

  if (isReaction && reactionExpanded) {
    return (
      <div ref={pickerRef} className={`emoji-picker emoji-picker--reaction-expanded ${className ?? ""}`.trim()} role="dialog" aria-label={label} data-mode={mode}>
        <label className="emoji-picker-search">
          <AppIcon name="search" size="xs" />
          <input
            ref={searchRef}
            value={query}
            placeholder="Search emoji"
            aria-label="Search emoji"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && visibleOptions.length) {
                event.preventDefault();
                focusEmoji(0);
              }
            }}
          />
        </label>
        {communityEmojis.length ? (
          <>
            <p className="emoji-picker-section-label">Community</p>
            <div className="emoji-picker-grid community-emoji-grid emoji-picker-grid--compact">
              {communityEmojis.map((emoji) => (
                <button key={emoji.id} type="button" title={`:${emoji.name}:`} aria-label={`Custom emoji ${emoji.name}`} onClick={() => selectEmoji(`:${emoji.name}:`, emoji.name, false)}>
                  <img src={emoji.imageUrl} alt="" />
                </button>
              ))}
            </div>
          </>
        ) : null}
        {renderEmojiGrid(visibleOptions, "emoji-picker-grid--compact")}
        {!visibleOptions.length ? <p className="emoji-picker-empty">No emoji found.</p> : null}
      </div>
    );
  }

  return (
    <div ref={pickerRef} className={`emoji-picker ${className ?? ""}`.trim()} role="dialog" aria-label={label} data-mode={mode}>
      <div className="emoji-picker-header">
        <div>
          <strong>Insert emoji</strong>
          <span>Search or use arrow keys to choose</span>
        </div>
        <span className="emoji-picker-mode">Message</span>
      </div>
      <label className="emoji-picker-search">
        <AppIcon name="search" size="xs" />
        <input
          ref={searchRef}
          value={query}
          placeholder="Search emoji"
          aria-label="Search emoji"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && visibleOptions.length) {
              event.preventDefault();
              focusEmoji(0);
            }
          }}
        />
      </label>
      <div className="emoji-picker-tabs" role="tablist" aria-label="Emoji categories">
        {categoryOrder.map((category, categoryIndex) => (
          <button
            key={category}
            type="button"
            role="tab"
            data-emoji-category={category}
            aria-selected={activeCategory === category && !query}
            className={activeCategory === category && !query ? "active" : ""}
            onKeyDown={(event) => onCategoryKeyDown(event, categoryIndex)}
            onClick={() => {
              setQuery("");
              setActiveCategory(category);
            }}
          >
            {emojiCategoryLabels[category]}
          </button>
        ))}
      </div>
      {communityEmojis.length ? (
        <>
          <p className="emoji-picker-section-label">Community</p>
          <div className="emoji-picker-grid community-emoji-grid">
            {communityEmojis.map((emoji) => (
              <button key={emoji.id} type="button" title={`:${emoji.name}:`} aria-label={`Custom emoji ${emoji.name}`} onClick={() => selectEmoji(`:${emoji.name}:`, emoji.name, false)}>
                <img src={emoji.imageUrl} alt="" />
              </button>
            ))}
          </div>
        </>
      ) : null}
      {renderEmojiGrid(visibleOptions)}
      <span className="emoji-picker-results" aria-live="polite">{visibleOptions.length} emoji{visibleOptions.length === 1 ? "" : "s"}</span>
      {!visibleOptions.length ? <p className="emoji-picker-empty">No emoji found.</p> : null}
    </div>
  );
}
