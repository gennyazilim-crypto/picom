import type { Attachment } from "../types/community";

const svgImage = (label: string, a: string, b: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="960" height="640" rx="52" fill="url(#g)"/><circle cx="770" cy="140" r="124" fill="rgba(255,255,255,.22)"/><path d="M76 520 C220 344 356 446 504 296 C640 158 748 296 886 208 L886 564 L76 564 Z" fill="rgba(255,255,255,.30)"/><text x="74" y="104" font-family="Arial" font-size="44" font-weight="700" fill="rgba(255,255,255,.92)">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};
const markDevelopmentSafe = (items: Attachment[]): Attachment[] => items.map((item) => ({ ...item, scanStatus: "skipped_development" }));

export const mockAttachmentLayouts = {
  one(prefix: string): Attachment[] {
    return markDevelopmentSafe([{ id: `${prefix}-att-1`, type: "image", url: svgImage("Picom 01", "#007571", "#10C2BB"), alt: "Teal desktop gradient", width: 960, height: 640 }]);
  },
  two(prefix: string): Attachment[] {
    return markDevelopmentSafe([
      { id: `${prefix}-att-2a`, type: "image", url: svgImage("Frame A", "#10C2BB", "#007571"), alt: "Aqua frame", width: 960, height: 640 },
      { id: `${prefix}-att-2b`, type: "image", url: svgImage("Frame B", "#FF772E", "#C24D0F"), alt: "Orange frame", width: 960, height: 640 },
    ]);
  },
  three(prefix: string): Attachment[] {
    return markDevelopmentSafe([
      { id: `${prefix}-att-3a`, type: "image", url: svgImage("Mood A", "#C24D0F", "#752C05"), alt: "Burnt orange mood", width: 960, height: 640 },
      { id: `${prefix}-att-3b`, type: "image", url: svgImage("Mood B", "#007571", "#10C2BB"), alt: "Teal mood", width: 960, height: 640 },
      { id: `${prefix}-att-3c`, type: "image", url: svgImage("Mood C", "#FF772E", "#752C05"), alt: "Autumn mood", width: 960, height: 640 },
    ]);
  },
  four(prefix: string): Attachment[] {
    return markDevelopmentSafe([
      { id: `${prefix}-att-4a`, type: "image", url: svgImage("Shot 1", "#007571", "#10C2BB"), alt: "Shot one", width: 960, height: 640 },
      { id: `${prefix}-att-4b`, type: "image", url: svgImage("Shot 2", "#FF772E", "#C24D0F"), alt: "Shot two", width: 960, height: 640 },
      { id: `${prefix}-att-4c`, type: "image", url: svgImage("Shot 3", "#C24D0F", "#752C05"), alt: "Shot three", width: 960, height: 640 },
      { id: `${prefix}-att-4d`, type: "image", url: svgImage("Shot 4", "#10C2BB", "#007571"), alt: "Shot four", width: 960, height: 640 },
    ]);
  },
} as const;

export function createMockAttachmentsForMessage(prefix: string, messageIndex: number): Attachment[] | undefined {
  if (messageIndex === 2) return mockAttachmentLayouts.one(prefix);
  if (messageIndex === 4) return mockAttachmentLayouts.two(prefix);
  if (messageIndex === 6) return mockAttachmentLayouts.three(prefix);
  if (messageIndex === 7) return mockAttachmentLayouts.four(prefix);
  return undefined;
}
