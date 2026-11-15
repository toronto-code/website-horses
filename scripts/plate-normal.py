"""Bake the grain normal map for the cursor-lit plate.

R/G encode the surface normal of the pearl-blast grain, B carries the tonal
mottling. The surface is deliberately imperfect, like real stock: a few thin
scratches, faint vertical rolling bands, sparse pits, and broad tonal stains.
Output: public/plate-options/plate-normals.webp (lossless).
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, map_coordinates

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 2560, 1440
SLOPE = .045  # grain steepness; shader relief multiplies on top

y, x = np.mgrid[:HEIGHT, :WIDTH].astype('float32')
xn, yn = x / WIDTH, y / HEIGHT
rng = np.random.default_rng(603)

grit = rng.standard_normal((HEIGHT, WIDTH), dtype='float32')
grain = gaussian_filter(grit, (.85, .85))
height = 6.4 * grain / grain.std() + 2.75 * grit

# Thin scratches: some incised, some proud, thin enough to glint as lines.
def scratch_layer(count, lengths):
    sheet = Image.new('L', (WIDTH, HEIGHT), 0)
    pen = ImageDraw.Draw(sheet)
    for _ in range(count):
        x0, y0 = rng.uniform(0, WIDTH), rng.uniform(0, HEIGHT)
        angle = rng.uniform(0, np.pi)
        length = rng.uniform(*lengths) * WIDTH
        pen.line([(x0, y0), (x0 + np.cos(angle) * length, y0 + np.sin(angle) * length)],
                 fill=255, width=1)
    return gaussian_filter(np.asarray(sheet, dtype='float32') / 255, (.6, .6))

height += 4.0 * scratch_layer(7, (.02, .06)) \
        + 4.6 * scratch_layer(2, (.10, .22)) \
        - 3.6 * scratch_layer(4, (.02, .05)) \
        - 4.2 * scratch_layer(2, (.09, .16))

# Sparse pits and proud specks, a few pixels wide.
specks = np.clip(rng.standard_normal((HEIGHT, WIDTH), dtype='float32') - 4.3, 0, None)
height -= 6.0 * gaussian_filter(specks, (.5, .5))

# Faint vertical rolling bands, as if the stock passed through a mill, with
# their strength drifting across the sheet.
bands = gaussian_filter(rng.standard_normal((HEIGHT, WIDTH), dtype='float32'), (60, 1.5))
drift = gaussian_filter(rng.standard_normal((HEIGHT, WIDTH), dtype='float32'), (240, 6))
height += (.45 + .75 / (1 + np.exp(-3 * drift / drift.std()))) * bands

# Tonal mottling plus broad stain ghosts and vertical streaks.
clouds = np.zeros_like(xn)
for scale, amplitude in [(4, 3.0), (8, 1.8), (17, .9)]:
    cols = max(4, round(scale * WIDTH / HEIGHT))
    clouds += amplitude * map_coordinates(
        rng.normal(size=(scale, cols)).astype('float32'),
        [yn*(scale-1), xn*(cols-1)], order=3, mode='reflect')
stains = gaussian_filter(rng.standard_normal((HEIGHT, WIDTH), dtype='float32'), (55, 55))
streaks = gaussian_filter(rng.standard_normal((HEIGHT, WIDTH), dtype='float32'), (2.5, 150))
tone = clouds + 3.2 * stains / stains.std() + 2.6 * streaks / streaks.std()

dh_dy, dh_dx = np.gradient(height)
nx = -dh_dx * SLOPE
ny = -dh_dy * SLOPE
nz = np.ones_like(height)
length = np.sqrt(nx*nx + ny*ny + nz*nz)
channels = [
    np.uint8(np.clip((nx / length * .5 + .5) * 255, 0, 255)),
    np.uint8(np.clip((ny / length * .5 + .5) * 255, 0, 255)),
    np.uint8(np.clip(128 + tone, 0, 255)),
]
output = ROOT / 'public' / 'plate-options'
output.mkdir(parents=True, exist_ok=True)
image = Image.merge('RGB', [Image.fromarray(c) for c in channels])
image.save(output / 'plate-normals.webp', lossless=True, method=6)
print('plate-normals.webp', WIDTH, 'x', HEIGHT,
      'normal sd', round(float((nx/length).std() + (ny/length).std()) / 2, 4))
