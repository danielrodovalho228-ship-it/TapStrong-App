"""Builds the app icon, adaptive icon layers, favicon and splash image.

Flat brand mark (SPEC §2.6, §4: no gradients): a white condensed "T" on ink,
with the accent tap dot from the body map (accent fill, white ring).

    python3 scripts/build-icons.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets/images')
FONT = os.path.join(
    ROOT, 'node_modules/@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf'
)
INK = (18, 18, 18, 255)
WHITE = (255, 255, 255, 255)
ACCENT = (194, 62, 23, 255)
BACKGROUND = (243, 241, 237, 255)
SS = 4  # supersampling for smooth edges


def mark(size, bg, fg=WHITE, dot=ACCENT, ring=WHITE, scale=1.0):
    """The T + dot centred in a square canvas; scale shrinks it for safe zones."""
    s = size * SS
    img = Image.new('RGBA', (s, s), bg)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(s * 0.78 * scale))
    box = d.textbbox((0, 0), 'T', font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    x = (s - w) / 2 - box[0] - s * 0.04 * scale
    y = (s - h) / 2 - box[1] - s * 0.02 * scale
    d.text((x, y), 'T', font=font, fill=fg)
    # Tap dot on the lower right of the stem.
    r = s * 0.085 * scale
    cx = s / 2 + s * 0.075 * scale
    cy = s / 2 + s * 0.235 * scale
    ring_w = s * 0.028 * scale
    if ring is not None:
        d.ellipse((cx - r - ring_w, cy - r - ring_w, cx + r + ring_w, cy + r + ring_w), fill=ring)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=dot)
    return img.resize((size, size), Image.LANCZOS)


def save(img, name):
    img.save(os.path.join(OUT, name), optimize=True)
    print('wrote', name, img.size)


save(mark(1024, INK).convert('RGB'), 'icon.png')
save(mark(48, INK), 'favicon.png')
# Android adaptive icon: the mark inside the 66% safe zone.
save(mark(512, (0, 0, 0, 0), scale=0.62), 'android-icon-foreground.png')
save(Image.new('RGBA', (512, 512), INK), 'android-icon-background.png')
save(
    mark(432, (0, 0, 0, 0), fg=WHITE, dot=WHITE, ring=(0, 0, 0, 0), scale=0.62),
    'android-icon-monochrome.png',
)

# Splash: wordmark in ink with the tap dot, on the app background.
W, H = 1200, 360
s = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(s)
font = ImageFont.truetype(FONT, int(H * SS * 0.62))
text = 'TAPSTRONG'
box = d.textbbox((0, 0), text, font=font)
tw, th = box[2] - box[0], box[3] - box[1]
r = H * SS * 0.07
gap = r * 1.2
tx = (W * SS - tw - gap - 2 * r) / 2 - box[0]
ty = (H * SS - th) / 2 - box[1]
d.text((tx, ty), text, font=font, fill=INK)
cx = tx + box[2] + gap + r
cy = ty + box[3] - r
d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ACCENT)
save(s.resize((W, H), Image.LANCZOS), 'splash-icon.png')
