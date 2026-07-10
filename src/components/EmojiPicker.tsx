import { useEffect, useMemo, useRef, useState } from "react";
import { emojiCategoryLabels, emojiOptions, type EmojiCategoryId } from "../data/emojiOptions";
import { AppIcon } from "./AppIcon";
import { customEmojiService } from "../services/customEmojiService";

type EmojiPickerProps = {
  label: string;
  className?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  communityId?: string;
};

const categoryOrder: EmojiCategoryId[] = ["frequent", "smileys", "gestures", "objects", "symbols"];

export function EmojiPicker({ label, className, onSelect, onClose, communityId }: EmojiPickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryId>("frequent");
  const pickerRef = useRef<HTMLDivElement>(null);

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

  const visibleOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return emojiOptions.filter((option) => {
      if (normalized) return option.label.includes(normalized) || option.emoji.includes(normalized);
      return option.category === activeCategory;
    });
  }, [activeCategory, query]);
  const communityEmojis = useMemo(() => communityId ? customEmojiService.list(communityId).filter((emoji) => !query.trim() || emoji.name.includes(query.trim().toLowerCase())) : [], [communityId, query]);

  return (
    <div ref={pickerRef} className={`emoji-picker ${className ?? ""}`} role="dialog" aria-label={label}>
      <label className="emoji-picker-search">
        <AppIcon name="search" size="xs" />
        <input value={query} placeholder="Search emoji" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="emoji-picker-tabs" aria-label="Emoji categories">
        {categoryOrder.map((category) => (
          <button
            key={category}
            type="button"
            className={activeCategory === category && !query ? "active" : ""}
            onClick={() => {
              setQuery("");
              setActiveCategory(category);
            }}
          >
            {emojiCategoryLabels[category]}
          </button>
        ))}
      </div>
      {communityEmojis.length ? <><p className="emoji-picker-section-label">Community</p><div className="emoji-picker-grid community-emoji-grid">{communityEmojis.map((emoji) => <button key={emoji.id} type="button" title={`:${emoji.name}:`} aria-label={`Custom emoji ${emoji.name}`} onClick={() => onSelect(`:${emoji.name}:`)}><img src={emoji.imageUrl} alt="" /></button>)}</div></> : null}
      <div className="emoji-picker-grid" role="listbox" aria-label={query ? "Search results" : emojiCategoryLabels[activeCategory]}>
        {visibleOptions.map((option) => (
          <button
            key={`${option.category}-${option.label}-${option.emoji}`}
            type="button"
            aria-label={option.label}
            title={option.label}
            onClick={() => onSelect(option.emoji)}
          >
            {option.emoji}
          </button>
        ))}
      </div>
      {!visibleOptions.length ? <p className="emoji-picker-empty">No emoji found.</p> : null}
    </div>
  );
}
