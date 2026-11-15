"""Bake candidate silver plates with distinct surface textures.

Every option shares the same even midtone (no reflection, no sweep); only the
finish varies. Output: public/plate-options/opt-11..opt-20-<slug>.webp
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1600, 900
TONE = 130
MOTTLE = [(4, 2.1), (8, 1.3), (17, .6)]  # shared whisper of mottling
QUALITY = 88

Y, X = np.mgrid[:HEIGHT, :WIDTH].astype('float32')
XN, YN = X / WIDTH, Y / HEIGHT


def normal(rng, shape=None):
    return rng.standard_normal(shape or (HEIGHT, WIDTH)).astype('float32')


def sample(rng, field, idx1, idx2, shape, mode='grid-wrap'):
    return map_coordinates(field, [idx1 % shape[0], idx2 % shape[1]],
                           order=3, mode=mode).astype('float32')


def hairline(rng):
    texture = gaussian_filter(normal(rng), (.35, 5.0))
    return 4.5 * texture + 1.2 * normal(rng)


def crosshatch(rng):
    texture = gaussian_filter(normal(rng), (2.2, .35)) + gaussian_filter(normal(rng), (.35, 2.2))
    return 4.2 * texture / 1.41 + 1.0 * normal(rng)


def orbital(rng):
    # Swirls are sampled on a coarse grid, then upscaled: the rings stay smooth
    # and the patch centre softens instead of collapsing into aliasing.
    coarse_w, coarse_h = 400, 225
    ys, xs = np.mgrid[:coarse_h, :coarse_w].astype('float32')
    dx = (xs - coarse_w / 2) / (coarse_h / 2)
    dy = (ys - coarse_h / 2) / (coarse_h / 2)
    theta = (np.arctan2(dy, dx) + np.pi) / (2 * np.pi)
    radius = np.hypot(dx, dy)
    rings, columns = 24, 340
    # The angular coefficient equals the row count, so the field wraps
    # seamlessly where the turn closes on itself.
    u1 = theta * rings + np.log(radius + .08) * 10 % rings
    u2 = radius * 160
    swirl = map_coordinates(rng.normal(size=(rings, columns)).astype('float32'),
                            [u1 % rings, u2], order=1, mode='wrap')
    swirl = np.asarray(Image.fromarray(np.uint8(np.clip(swirl / swirl.std() * 64 + 128, 0, 255)))
                       .resize((WIDTH, HEIGHT), Image.Resampling.BILINEAR), dtype='float32')
    swirl = gaussian_filter((swirl - 128) / 64, (.9, .9))
    return 3.4 * swirl / swirl.std() + 1.0 * normal(rng)


def tumbled(rng):
    pebble = gaussian_filter(normal(rng), (2.4, 2.4))
    return 6.0 * pebble / pebble.std() + 1.5 * normal(rng)


def hammered(rng):
    spacing = 46
    points = rng.uniform((0, 0), (HEIGHT, WIDTH),
                         (round(HEIGHT / spacing) * round(WIDTH / spacing), 2))
    grid = np.dstack([Y, X]).reshape(-1, 2)
    dist, _ = cKDTree(points).query(grid, k=2)
    depth = dist[:, 0] / np.maximum(dist[:, 1], 1e-3)
    bowl = 1 - (2 * depth - 1) ** 2          # bright centre, rim falls off
    rim = np.exp(-((depth - .82) / .16) ** 2)  # faint ring at each cell edge
    dimple = (bowl * 1.6 - rim * 2.1).reshape(HEIGHT, WIDTH)
    dimple = gaussian_filter(dimple.astype('float32'), 1.2)
    return 4.4 * dimple + 1.4 * normal(rng)


def flake(rng):
    base = gaussian_filter(normal(rng), (.7, .7))
    specks = normal(rng)
    glint = gaussian_filter(np.clip(specks - 2.6, 0, None), (.4, .4))
    shade = gaussian_filter(np.clip(-2.6 - specks, 0, None), (.4, .4))
    return 4.0 * base / base.std() + 26 * glint - 18 * shade + .8 * normal(rng)


def frost(rng):
    texture = gaussian_filter(normal(rng), (.6, .6))
    return 7.5 * texture / texture.std() + 3.5 * normal(rng)


def stonewash(rng):
    scratches = gaussian_filter(normal(rng), (.8, 3.5))
    scratches *= np.abs(scratches) > .8 * scratches.std()  # keep only bold strokes
    scratches = gaussian_filter(scratches, (.5, .5))
    return 5.5 * scratches / scratches.std() + 2.5 * gaussian_filter(normal(rng), (.6, .6))


def cast(rng):
    mineral = 5.0 * gaussian_filter(normal(rng), (6, 6)) + 4.0 * gaussian_filter(normal(rng), (14, 14))
    return mineral / mineral.std() + 1.0 * normal(rng)


def dragged(rng):
    streaks = gaussian_filter(normal(rng), (.5, 7.0))
    breaks = gaussian_filter(normal(rng), (3, 3))
    breaks = .35 + .65 / (1 + np.exp(-3 * breaks))  # soft 0.35..1 dropout
    streaks = streaks * breaks
    return 4.8 * streaks / streaks.std() + 1.3 * normal(rng)


TEXTURES = [
    ('hairline', hairline),
    ('crosshatch', crosshatch),
    ('orbital', orbital),
    ('tumbled', tumbled),
    ('hammered', hammered),
    ('flake', flake),
    ('frost', frost),
    ('stonewash', stonewash),
    ('cast', cast),
    ('dragged', dragged),
]


def bake(slug, texture, number, seed):
    rng = np.random.default_rng(seed)
    clouds = np.zeros_like(X)
    for scale, amplitude in MOTTLE:
        cols = max(4, round(scale * WIDTH / HEIGHT))
        clouds += amplitude * map_coordinates(
            rng.normal(size=(scale, cols)).astype('float32'),
            [YN*(scale-1), XN*(cols-1)], order=3, mode='reflect')
    signal = TONE + clouds + texture(rng)
    image = Image.fromarray(np.clip(np.rint(signal), 0, 255).astype('uint8'))
    output = ROOT / 'public' / 'plate-options'
    output.mkdir(parents=True, exist_ok=True)
    image.save(output / f'opt-{number:02d}-{slug}.webp', quality=QUALITY, method=6)
    print(f'opt-{number:02d} {slug:11} mean {signal.mean():6.1f} '
          f'sd {signal.std():5.1f}')


if __name__ == '__main__':
    for number, (slug, texture) in enumerate(TEXTURES, start=11):
        bake(slug, texture, number=number, seed=500 + number)
