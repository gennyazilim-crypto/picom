"""Generate Picom Windows NSIS installer sidebar bitmap from the approved brand logo.

Output (required NSIS size):
  - assets/installer/windows/installer-sidebar.bmp (164 x 314)

Also writes preview assets under docs/installer/previews/:
  - installer-sidebar.png
  - picom-logo-transparent.png

No top header strip — branding lives only in the sidebar.

Requires: pip install pillow
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "assets" / "brand" / "picom-logo-mic-chrome-v1.png"
FALLBACK_ICON = ROOT / "assets" / "brand" / "app-icon.png"
OUT_DIR = ROOT / "assets" / "installer" / "windows"
SIDEBAR_PATH = OUT_DIR / "installer-sidebar-v2.bmp"
PREVIEW_DIR = ROOT / "docs" / "installer" / "previews"

# Soft studio light — cool gray, crimson accent only
TOP = (248, 250, 252)
MID = (232, 238, 244)
BOTTOM = (217, 226, 235)
CRIMSON = (196, 28, 48)
CRIMSON_SOFT = (196, 28, 48, 90)


def vertical_gradient(size: tuple[int, int], stops: list[tuple[float, tuple[int, int, int]]]) -> Image.Image:
    width, height = size
    image = Image.new("RGB", size, stops[0][1])
    draw = ImageDraw.Draw(image)
    for y in range(height):
        t = y / max(height - 1, 1)
        # find segment
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1 or i == len(stops) - 2:
                local = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                local = max(0.0, min(1.0, local))
                color = tuple(int(c0[j] + (c1[j] - c0[j]) * local) for j in range(3))
                draw.line([(0, y), (width - 1, y)], fill=color)
                break
    return image


def load_logo() -> Image.Image:
    path = LOGO_PATH if LOGO_PATH.exists() else FALLBACK_ICON
    if not path.exists():
        raise SystemExit(f"Missing brand logo: {LOGO_PATH} (and no fallback {FALLBACK_ICON})")
    logo = Image.open(path).convert("RGBA")
    alpha = logo.split()[-1]
    if alpha.getpixel((0, 0)) > 16 and alpha.getpixel((logo.width - 1, 0)) > 16:
        raise SystemExit(
            "Logo corners are still opaque. Run `python scripts/knockout-logo-background.py` first."
        )
    return logo


def paste_centered(base: Image.Image, overlay: Image.Image, max_w: int, max_h: int, offset_y: int = 0) -> None:
    overlay = overlay.copy()
    overlay.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
    x = (base.width - overlay.width) // 2
    y = (base.height - overlay.height) // 2 + offset_y
    base.paste(overlay, (x, y), overlay)


def soft_spotlight(size: tuple[int, int]) -> Image.Image:
    """Subtle radial light behind the mark — not a card."""
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx, cy = w // 2, int(h * 0.40)
    rx, ry = int(w * 0.58), int(h * 0.34)
    for i in range(18, 0, -1):
        alpha = int(22 * (i / 18))
        pad = (18 - i) * 3
        draw.ellipse(
            (cx - rx - pad, cy - ry - pad, cx + rx + pad, cy + ry + pad),
            fill=(255, 255, 255, alpha),
        )
    return layer.filter(ImageFilter.GaussianBlur(radius=6))


def accent_bar(size: tuple[int, int]) -> Image.Image:
    """Thin crimson rail with soft fade at ends."""
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    bar_w = 3
    margin = 18
    for y in range(margin, h - margin):
        t = (y - margin) / max(h - 2 * margin - 1, 1)
        # peak opacity in the middle third
        if t < 0.2:
            a = t / 0.2
        elif t > 0.8:
            a = (1 - t) / 0.2
        else:
            a = 1.0
        alpha = int(230 * a)
        draw.line([(0, y), (bar_w - 1, y)], fill=(CRIMSON[0], CRIMSON[1], CRIMSON[2], alpha))
    return layer


def wordmark_strip(base: Image.Image) -> None:
    """Small PICOM caption — drawn as simple spaced dots/blocks fallback via text if font ok."""
    try:
        from PIL import ImageFont
    except ImportError:
        return
    draw = ImageDraw.Draw(base)
    text = "PICOM"
    try:
        font = ImageFont.truetype("segoeui.ttf", 11)
    except OSError:
        try:
            font = ImageFont.truetype("SegoeUI.ttf", 11)
        except OSError:
            font = ImageFont.load_default()
    # letter-spacing approximation
    total = 0
    glyphs = []
    for ch in text:
        bbox = draw.textbbox((0, 0), ch, font=font)
        glyphs.append((ch, bbox[2] - bbox[0]))
        total += bbox[2] - bbox[0]
    spacing = 3
    total += spacing * (len(text) - 1)
    x = (base.width - total) // 2
    y = base.height - 28
    fill = (90, 104, 118)
    for ch, gw in glyphs:
        draw.text((x, y), ch, font=font, fill=fill)
        x += gw + spacing


def build_sidebar(logo: Image.Image) -> Image.Image:
    image = vertical_gradient(
        (164, 314),
        [(0.0, TOP), (0.45, MID), (1.0, BOTTOM)],
    ).convert("RGBA")
    image = Image.alpha_composite(image, soft_spotlight((164, 314)))
    image = Image.alpha_composite(image, accent_bar((164, 314)))
    paste_centered(image, logo, max_w=118, max_h=118, offset_y=-18)
    rgb = image.convert("RGB")
    wordmark_strip(rgb)
    return rgb


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    logo = load_logo()
    # Transparent logo for HTML live preview (no baked sidebar chrome)
    logo_preview = logo.copy()
    logo_preview.thumbnail((236, 236), Image.Resampling.LANCZOS)
    logo_preview.save(PREVIEW_DIR / "picom-logo-transparent.png", format="PNG")

    sidebar = build_sidebar(logo)
    if sidebar.size != (164, 314):
        raise SystemExit(f"Sidebar size mismatch: {sidebar.size}")
    sidebar.save(SIDEBAR_PATH, format="BMP")
    sidebar.save(PREVIEW_DIR / "installer-sidebar.png", format="PNG")
    print(f"Source logo: {LOGO_PATH.name} (sidebar only, no header strip)")
    print(f"Wrote {SIDEBAR_PATH.relative_to(ROOT)} {sidebar.size}")
    print(f"Wrote {PREVIEW_DIR.relative_to(ROOT)}/installer-sidebar.png")
    print(f"Wrote {PREVIEW_DIR.relative_to(ROOT)}/picom-logo-transparent.png")


if __name__ == "__main__":
    main()
