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

    # A flat pearl-blasted silver: even midtone, faint mottling, fine
    # non-directional grain. No reflection and no tonal sweep.
    clouds = np.zeros_like(x)
    for scale, amplitude in [(4, 3.0), (8, 1.8), (17, .9)]:
        cols = max(4, round(scale * width / height))
        clouds += amplitude * map_coordinates(
            rng.normal(size=(scale, cols)).astype('float32'),
            [y*(scale-1), x*(cols-1)], order=3, mode='reflect')
    signal = 130 + clouds

    grit = rng.standard_normal((height, width), dtype='float32')
    blasted = gaussian_filter(grit, (.85, .85))
    blasted /= blasted.std()
    signal += 6.4 * blasted + 2.75 * grit
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
