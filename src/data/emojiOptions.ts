export type EmojiCategoryId = "frequent" | "smileys" | "gestures" | "objects" | "symbols";

export type EmojiOption = Readonly<{
  emoji: string;
  label: string;
  category: EmojiCategoryId;
}>;

export const emojiCategoryLabels: Record<EmojiCategoryId, string> = {
  frequent: "Recent",
  smileys: "Smileys",
  gestures: "Gestures",
  objects: "Objects",
  symbols: "Symbols",
};

export const emojiOptions: EmojiOption[] = [
  { emoji: "👍", label: "thumbs up", category: "frequent" },
  { emoji: "❤️", label: "heart", category: "frequent" },
  { emoji: "😂", label: "laughing", category: "frequent" },
  { emoji: "🔥", label: "fire", category: "frequent" },
  { emoji: "👀", label: "eyes", category: "frequent" },
  { emoji: "😀", label: "grinning", category: "smileys" },
  { emoji: "😄", label: "smile", category: "smileys" },
  { emoji: "😊", label: "warm smile", category: "smileys" },
  { emoji: "😎", label: "cool", category: "smileys" },
  { emoji: "🤩", label: "star struck", category: "smileys" },
  { emoji: "🙌", label: "celebrate", category: "gestures" },
  { emoji: "👏", label: "clap", category: "gestures" },
  { emoji: "🙏", label: "thanks", category: "gestures" },
  { emoji: "🤝", label: "handshake", category: "gestures" },
  { emoji: "💪", label: "strong", category: "gestures" },
  { emoji: "💡", label: "idea", category: "objects" },
  { emoji: "📌", label: "pin", category: "objects" },
  { emoji: "🖼️", label: "image", category: "objects" },
  { emoji: "🎧", label: "headphones", category: "objects" },
  { emoji: "🚀", label: "rocket", category: "objects" },
  { emoji: "✅", label: "done", category: "symbols" },
  { emoji: "⭐", label: "star", category: "symbols" },
  { emoji: "⚡", label: "energy", category: "symbols" },
  { emoji: "✨", label: "sparkles", category: "symbols" },
  { emoji: "❗", label: "important", category: "symbols" },
];
