"""Bake candidate silver plates for side-by-side review.

Each option keeps the plate flat — even tone, no reflection, no sweep — and
varies tone, tint, grain size/strength, mottle, or directionality.
Output: public/plate-options/opt-NN-<slug>.webp
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1600, 900
QUALITY = 88

# slug, tone, tint, grain sigma, grain amp, grit amp, mottle, directional
OPTIONS = [
    ('pearl-blast',  130, ( 0,  0,  0),  .85, 6.4, 2.75, 1.0, False),
    ('satin-light',  152, ( 0,  0,  0),  .80, 6.0, 2.50,  .7, False),
    ('sterling',     168, ( 0,  0,  0),  .70, 5.4, 2.20,  .5, False),
    ('graphite',     112, ( 0,  0,  0),  .85, 6.4, 2.75, 1.0, False),
    ('charcoal',      96, ( 0,  0,  0),  .85, 6.4, 2.75, 1.5, False),
    ('whisper',      130, ( 0,  0,  0),  .90, 2.9, 1.30,  .5, False),
    ('coarse-blast', 130, ( 0,  0,  0), 1.70, 7.2, 3.20, 1.2, False),
    ('cool-steel',   132, (-3,  0,  6),  .85, 6.4, 2.75, 1.0, False),
    ('warm-silver',  132, ( 5,  0, -5),  .85, 6.4, 2.75, 1.0, False),
    ('belt-sanded',  130, ( 0,  0,  0), 3.20, 4.6, 1.60,  .8, True),
]


def bake(slug, tone, tint, sigma, grain, grit, mottle, directional, seed):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[:HEIGHT, :WIDTH].astype('float32')
    x /= WIDTH
    y /= HEIGHT

    clouds = np.zeros_like(x)
    for scale, amplitude in [(4, 3.0), (8, 1.8), (17, .9)]:
        cols = max(4, round(scale * WIDTH / HEIGHT))
        clouds += amplitude * mottle * map_coordinates(
            rng.normal(size=(scale, cols)).astype('float32'),
            [y*(scale-1), x*(cols-1)], order=3, mode='reflect')
    signal = tone + clouds

    noise = rng.standard_normal((HEIGHT, WIDTH), dtype='float32')
    spread = (sigma, .50) if directional else (sigma, sigma)
    texture = gaussian_filter(noise, spread)
    texture /= texture.std()
    signal += grain * texture + grit * noise

    image = np.rint(signal)
    channels = [np.clip(image + offset, 0, 255).astype('uint8') for offset in tint]
    plate = Image.merge('RGB', [Image.fromarray(c) for c in channels])
    output = ROOT / 'public' / 'plate-options'
    output.mkdir(parents=True, exist_ok=True)
    plate.save(output / f'opt-{seed-416:02d}-{slug}.webp', quality=QUALITY, method=6)
    print(f'opt-{seed-416:02d} {slug:13} mean {signal.mean():6.1f}')


if __name__ == '__main__':
    for index, (slug, *recipe) in enumerate(OPTIONS, start=1):
        bake(slug, *recipe, seed=416 + index)
