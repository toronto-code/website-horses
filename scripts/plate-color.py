"""Bake the pearl-blast plate in an arbitrary flat colour.

Grain and mottling scale with each channel's brightness so the hue holds.
Usage: plate-color.py R G B number slug   (e.g. 204 31 19 32 red)
"""
from pathlib import Path
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1600, 900

red, green, blue, number, slug = sys.argv[1:6]
base = np.array([int(red), int(green), int(blue)], dtype='float32')
rng = np.random.default_rng(417)
y, x = np.mgrid[:HEIGHT, :WIDTH].astype('float32')
xn, yn = x / WIDTH, y / HEIGHT

clouds = np.zeros_like(x)
for scale, amplitude in [(4, 3.0), (8, 1.8), (17, .9)]:
    cols = max(4, round(scale * WIDTH / HEIGHT))
    clouds += amplitude * map_coordinates(
        rng.normal(size=(scale, cols)).astype('float32'),
        [yn*(scale-1), xn*(cols-1)], order=3, mode='reflect')
signal = 130 + clouds

grit = rng.standard_normal((HEIGHT, WIDTH), dtype='float32')
blasted = gaussian_filter(grit, (.85, .85))
signal += 6.4 * blasted / blasted.std() + 2.75 * grit

# channel-wise tint: the grain moves each channel in proportion to its level
field = (signal - 130) / 130
channels = [np.clip(base[c] * (1 + .92 * field), 0, 255) for c in range(3)]
output = ROOT / 'public' / 'plate-options'
output.mkdir(parents=True, exist_ok=True)
image = Image.merge('RGB', [Image.fromarray(np.uint8(np.rint(c))) for c in channels])
image.save(output / f'opt-{int(number):02d}-{slug}.webp', quality=88, method=6)
pixels = np.asarray(image, dtype='float32')
print(f'opt-{int(number):02d} {slug} mean rgb',
      [round(float(pixels[..., c].mean())) for c in range(3)])
