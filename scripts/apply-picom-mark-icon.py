"""Apply the approved Picom P+bubble mark as logo, favicon, and desktop app icon.

Reads the owner-provided master PNG, knocks out the black outer field so the
squircle sits on transparency, then regenerates:

  - assets/brand/picom-logo-mark-v1.png / .webp
  - assets/brand/app-icon.png / .ico
  - assets/brand/icons/{16,32,64,128,256,512,1024}x{size}.png
  - public/favicon.ico (web)

Usage:
  python scripts/apply-picom-mark-icon.py [optional-source.png]
"""

from __future__ import annotations

import shutil
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
ICONS = BRAND / "icons"
PUBLIC = ROOT / "public"
PUBLIC_ICONS = PUBLIC / "assets" / "brand" / "icons"

DEFAULT_SOURCES = [
    BRAND / "picom-logo-mark-v1.png",
]

SIZES = (16, 32, 64, 128, 256, 512, 1024)
ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)
COLOR_THRESHOLD = 28
SOFT_FRINGE = 12


def color_dist(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def remove_near_black_background(rgb: Image.Image) -> Image.Image:
    """Flood-fill near-black corners so the red squircle keeps a transparent outer field."""
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
        # Only treat near-black as outer field (protect red + white mark).
        if max(color) > 40:
            return False
        return any(color_dist(color, ref) <= COLOR_THRESHOLD for ref in bg_refs)

    visited = [[False] * height for _ in range(width)]
    queue: deque[tuple[int, int]] = deque()
    for x, y in seeds:
        if is_background(pixels[x, y]):
            queue.append((x, y))
            visited[x][y] = True

    background: set[tuple[int, int]] = set()
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
        out[x, y] = (r, g, b, 0)

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
            if max((r, g, b)) > 48:
                continue
            nearest = min(color_dist((r, g, b), ref) for ref in bg_refs)
            if nearest <= COLOR_THRESHOLD + SOFT_FRINGE:
                fade = max(
                    0,
                    min(255, int(255 * (nearest - COLOR_THRESHOLD) / max(SOFT_FRINGE, 1))),
                )
                out[x, y] = (r, g, b, fade)

    return rgba


def resolve_source() -> Path:
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
        if not path.exists():
            raise SystemExit(f"Missing source: {path}")
        return path
    for candidate in DEFAULT_SOURCES:
        if candidate.exists():
            return candidate
    raise SystemExit("No source icon found. Pass a PNG path as the first argument.")


def save_sizes(master: Image.Image) -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        out = ICONS / f"{size}x{size}.png"
        resized.save(out, format="PNG", optimize=True)
        print(f"Wrote {out.relative_to(ROOT)}")


def save_ico(master: Image.Image, dest: Path) -> None:
    frames = [master.resize((s, s), Image.Resampling.LANCZOS) for s in ICO_SIZES]
    # Largest first as container; append smaller sizes. Header count must be multi-size.
    frames[-1].save(
        dest,
        format="ICO",
        sizes=[(s, s) for s in ICO_SIZES],
        append_images=frames[:-1],
    )
    raw = dest.read_bytes()
    count = int.from_bytes(raw[4:6], "little")
    if count < 2:
        raise SystemExit(f"ICO write failed for {dest}: only {count} size(s)")
    print(f"Wrote {dest.relative_to(ROOT)} ({count} sizes, {dest.stat().st_size} bytes)")


def main() -> None:
    source_path = resolve_source()
    print(f"Source: {source_path}")

    master_rgba = remove_near_black_background(Image.open(source_path))
    if master_rgba.size != (1024, 1024):
        master_rgba = master_rgba.resize((1024, 1024), Image.Resampling.LANCZOS)

    mark_png = BRAND / "picom-logo-mark-v1.png"
    mark_webp = BRAND / "picom-logo-mark-v1.webp"
    app_png = BRAND / "app-icon.png"
    app_ico = BRAND / "app-icon.ico"

    BRAND.mkdir(parents=True, exist_ok=True)
    master_rgba.save(mark_png, format="PNG", optimize=True)
    master_rgba.save(app_png, format="PNG", optimize=True)
    master_rgba.resize((512, 512), Image.Resampling.LANCZOS).save(
        mark_webp, format="WEBP", quality=92, method=6
    )
    print(f"Wrote {mark_png.relative_to(ROOT)}")
    print(f"Wrote {mark_webp.relative_to(ROOT)}")
    print(f"Wrote {app_png.relative_to(ROOT)}")

    save_sizes(master_rgba)
    save_ico(master_rgba, app_ico)

    PUBLIC.mkdir(parents=True, exist_ok=True)
    favicon = PUBLIC / "favicon.ico"
    shutil.copyfile(app_ico, favicon)
    print(f"Wrote {favicon.relative_to(ROOT)}")

    PUBLIC_ICONS.mkdir(parents=True, exist_ok=True)
    for size in (32, 256, 512):
        src = ICONS / f"{size}x{size}.png"
        dest = PUBLIC_ICONS / f"{size}x{size}.png"
        shutil.copyfile(src, dest)
        print(f"Wrote {dest.relative_to(ROOT)}")

    alpha = master_rgba.split()[-1]
    transparent = sum(1 for v in alpha.getdata() if v == 0)
    print(f"Transparent pixels: {transparent}/{master_rgba.width * master_rgba.height}")
    print(
        f"Corner alpha: TL={alpha.getpixel((0, 0))} "
        f"TR={alpha.getpixel((master_rgba.width - 1, 0))}"
    )


if __name__ == "__main__":
    main()
