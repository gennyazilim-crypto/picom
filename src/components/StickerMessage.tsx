import { mockStickers } from "../data/mockStickers";
import { AppIcon } from "./AppIcon";
export function StickerMessage({ stickerId }: { stickerId: string }) { const sticker = mockStickers.find((item) => item.id === stickerId); if (!sticker) return null; return <div className={`sticker-message tone-${sticker.tone}`}><AppIcon name="image" size="xl" /><strong>{sticker.title}</strong><span>Picom sticker</span></div>; }
