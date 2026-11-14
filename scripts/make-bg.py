"""Bake the fixed brushed-metal plate. Run with NumPy, SciPy and Pillow."""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates

ROOT = Path(__file__).resolve().parents[1]


def bake(name, width, height, sizes, seed):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[:height, :width].astype('float32')
    x /= width
    y /= height

    def field(rows, columns):
        return map_coordinates(rng.normal(size=(rows, columns)).astype('float32'),
                               [y * (rows - 1), x * (columns - 1)], order=3, mode='reflect')

    # A broad reflection enters just beyond the top-right edge of the plate.
    light = np.exp(-(.85 * (x - 1.08)**2 + .95 * (y + .08)**2))
    wx = x + .035 * field(5, 7)
    wy = y + .045 * field(5, 7)
    clouds = np.zeros_like(x)
    for scale, amplitude in [(4, 7.8), (8, 4.2), (17, 2.0)]:
        cols = max(4, round(scale * width / height))
        cloud = rng.normal(size=(scale, cols)).astype('float32')
        clouds += amplitude * map_coordinates(cloud, [wy*(scale-1), wx*(cols-1)],
                                              order=3, mode='reflect')
    signal = (129 + 102 * light) * (1 + clouds / 255)
    signal -= 7.5 * np.exp(-((x - .29)**2 / .08 + (y - .65)**2 / .04))

    grit = rng.standard_normal((height, width), dtype='float32')
    brushed = gaussian_filter(grit, (3.9, .50))
    brushed /= brushed.std()
    signal += 3.2 * brushed + 1.6 * grit
    # Smooth shoulders preserve tonal detail at the extremes.
    for bound, direction in [(118, 1), (231, -1)]:
        signal = bound + direction * 2.0 * np.logaddexp(0, direction*(signal-bound)/2)
    image = Image.fromarray(np.rint(signal).astype('uint8'))
    masters = ROOT / 'art/steel'
    output = ROOT / 'public/steel'
    masters.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    image.save(masters / f'{name}.png', optimize=True)
    for size in sizes:
        image.resize((size, round(height * size / width)),
                     Image.Resampling.LANCZOS).save(output / f'{name}-{size}.webp',
                                                  quality=90, method=6)
    print(name, 'mean', round(signal.mean(), 2), 'percentiles',
          np.percentile(image, [0, .5, 2, 50, 98, 100]))


if __name__ == '__main__':
    bake('landscape', 2560, 1440, [2560, 1600, 960], 417)
    bake('portrait', 1080, 1920, [1080, 720], 418)
