"""Generate lightweight browser assets from the original PNG artwork (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageOps

ASSETS = Path(__file__).resolve().parents[1] / "assets" / "mousecamp4"
# Maximum dimensions reflect the largest on-screen use, with room for high DPI.
SIZES = {
    "space-background": (1440, 810),
    "hangar-interior": (1200, 675),
    "launch-scene": (768, 768),
    "cargo-ship": (640, 427),
    "daidai-astronaut": (256, 256),
    "sos-signal": (384, 384),
    "planet-photo": (384, 384),
    "energy-battery": (384, 384),
    "asteroid": (192, 192),
    "ufo": (256, 256),
}

if __name__ == "__main__":
    before = after = 0
    for name, size in SIZES.items():
        source = ASSETS / (name + ".png")
        target = ASSETS / (name + ".webp")
        with Image.open(source) as original:
            artwork = ImageOps.exif_transpose(original)
            artwork.thumbnail(size, Image.Resampling.LANCZOS)
            artwork.save(target, "WEBP", quality=82, method=6)
        before += source.stat().st_size
        after += target.stat().st_size
        print(f"{name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes")
    print(f"TOTAL: {before:,} -> {after:,} bytes ({100 * (1 - after / before):.1f}% smaller)")
