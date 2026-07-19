"""Remove baked light backgrounds from the Picom chrome-mic logo via edge flood-fill.

Writes:
  - assets/brand/picom-logo-mic-chrome-v1.png (RGBA, transparent bg)
  - assets/brand/picom-logo-mic-chrome-v1.webp
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "brand" / "picom-logo-mic-chrome-v1.png"
OUT_PNG = SRC
OUT_WEBP = ROOT / "assets" / "brand" / "picom-logo-mic-chrome-v1.webp"

# How close a pixel must be to the sampled edge color to be treated as background.
COLOR_THRESHOLD = 42
# Soft fringe: fade alpha for near-background pixels at the cut edge.
SOFT_FRINGE = 18


def color_dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def remove_background(rgb: Image.Image) -> Image.Image:
    rgb = rgb.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    assert pixels is not None

    seeds = [
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
        (width // 2, 0),
        (width // 2, height - 1),
        (0, height // 2),
        (width - 1, height // 2),
    ]
    bg_refs = [pixels[x, y] for x, y in seeds]

    def is_background(color: tuple[int, int, int]) -> bool:
        return any(color_dist(color, ref) <= COLOR_THRESHOLD for ref in bg_refs)

    visited = [[False] * height for _ in range(width)]
    queue: deque[tuple[int, int]] = deque()
    for x, y in seeds:
        if is_background(pixels[x, y]):
            queue.append((x, y))
            visited[x][y] = True

    background = set()
    while queue:
        x, y = queue.popleft()
        background.add((x, y))
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height or visited[nx][ny]:
                continue
            if not is_background(pixels[nx, ny]):
                continue
            visited[nx][ny] = True
            queue.append((nx, ny))

    rgba = rgb.convert("RGBA")
    out = rgba.load()
    assert out is not None
    for x, y in background:
        r, g, b, _ = out[x, y]
        # Fully transparent background.
        out[x, y] = (r, g, b, 0)

    # Soften the cut edge: near-bg colors adjacent to bg get reduced alpha.
    for x in range(width):
        for y in range(height):
            if (x, y) in background:
                continue
            r, g, b, a = out[x, y]
            touches_bg = any(
                0 <= nx < width and 0 <= ny < height and (nx, ny) in background
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if not touches_bg:
                continue
            nearest = min(color_dist((r, g, b), ref) for ref in bg_refs)
            if nearest <= COLOR_THRESHOLD + SOFT_FRINGE:
                fade = max(0, min(255, int(255 * (nearest - COLOR_THRESHOLD) / max(SOFT_FRINGE, 1))))
                out[x, y] = (r, g, b, fade)

    return rgba


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Missing logo: {SRC}")
    source = Image.open(SRC)
    source_alpha = source.getchannel("A") if "A" in source.getbands() else None
    rgba = source.convert("RGBA") if source_alpha and source_alpha.getextrema()[0] < 255 else remove_background(source)
    rgba.save(OUT_PNG, format="PNG")
    rgba.resize((512, 512), Image.Resampling.LANCZOS).save(OUT_WEBP, format="WEBP", quality=90)
    alpha = rgba.split()[-1]
    transparent = sum(1 for v in alpha.getdata() if v == 0)
    print(f"Wrote {OUT_PNG.relative_to(ROOT)} mode={rgba.mode}")
    print(f"Wrote {OUT_WEBP.relative_to(ROOT)}")
    print(f"Transparent pixels: {transparent}/{rgba.width * rgba.height}")
    print(f"Corner alpha: TL={alpha.getpixel((0, 0))} TR={alpha.getpixel((rgba.width - 1, 0))}")


if __name__ == "__main__":
    main()
