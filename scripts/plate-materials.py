"""Bake ten non-metal background materials for the plate review page.

Every option stays evenly lit — tone and texture only, no light sweeps.
Output: public/plate-options/opt-22..opt-31-<slug>.webp
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, map_coordinates
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1600, 900
QUALITY = 88

Y, X = np.mgrid[:HEIGHT, :WIDTH].astype('float32')
XN, YN = X / WIDTH, Y / HEIGHT


def normal(rng):
    return rng.standard_normal((HEIGHT, WIDTH)).astype('float32')


def clouds(rng, scales=((4, 3.0), (8, 1.8), (17, .9))):
    field = np.zeros_like(X)
    for scale, amplitude in scales:
        cols = max(4, round(scale * WIDTH / HEIGHT))
        field += amplitude * map_coordinates(
            rng.normal(size=(scale, cols)).astype('float32'),
            [YN*(scale-1), XN*(cols-1)], order=3, mode='reflect')
    return field


def strokes(rng, count, lengths, width=1, blur=.6):
    sheet = Image.new('L', (WIDTH, HEIGHT), 0)
    pen = ImageDraw.Draw(sheet)
    for _ in range(count):
        x0, y0 = rng.uniform(0, WIDTH), rng.uniform(0, HEIGHT)
        angle = rng.uniform(0, 2 * np.pi)
        length = rng.uniform(*lengths) * WIDTH
        pen.line([(x0, y0), (x0 + np.cos(angle) * length, y0 + np.sin(angle) * length)],
                 fill=255, width=width)
    return gaussian_filter(np.asarray(sheet, dtype='float32') / 255, (blur, blur))


def specks(rng, threshold, amp, blur=.5):
    dots = np.clip(rng.standard_normal((HEIGHT, WIDTH), dtype='float32') - threshold, 0, None)
    return amp * gaussian_filter(dots, (blur, blur))


def compose(rgb):
    return Image.merge('RGB', [Image.fromarray(np.uint8(np.clip(c, 0, 255)))
                               for c in rgb])


def paper(rng):
    base = np.array([234, 228, 216], dtype='float32')
    field = (clouds(rng, ((3, 2.2), (7, 1.4))) + 1.1 * normal(rng)
             + 3.2 * strokes(rng, 260, (.004, .014), width=1, blur=.5)
             - 2.6 * strokes(rng, 220, (.004, .014), width=1, blur=.5))
    laid = 1.1 * np.sin(Y * .55 + 2 * np.sin(X * .004)) * np.sin(X * .021)
    field += laid
    return compose([base[c] + field for c in range(3)])


def limewash(rng):
    base = np.array([207, 201, 192], dtype='float32')
    field = clouds(rng, ((3, 5.5), (6, 3.2), (13, 1.8)))
    field += 2.4 * gaussian_filter(normal(rng), (2.0, 6.5))
    field += .8 * normal(rng)
    field -= specks(rng, 3.6, 5.0)
    return compose([base[c] + field for c in range(3)])


def concrete(rng):
    base = np.array([185, 188, 190], dtype='float32')
    field = clouds(rng, ((3, 4.0), (7, 2.4), (15, 1.4)))
    field += 2.0 * gaussian_filter(normal(rng), (.8, .8))
    field += .7 * normal(rng)
    field -= specks(rng, 3.4, 13.0)
    field -= specks(rng, 2.9, 7.0, blur=1.0)
    field -= 7.0 * strokes(rng, 1, (.28, .44), width=1, blur=.45)  # hairline crack
    field -= 4.0 * strokes(rng, 2, (.05, .12), width=1, blur=.4)
    return compose([base[c] + field for c in range(3)])


def linen(rng):
    base = np.array([214, 204, 186], dtype='float32')
    pitch = 3.15
    across = np.sin(np.pi * Y / pitch) ** 2      # horizontal threads on top
    along = np.sin(np.pi * X / pitch) ** 2       # vertical threads beneath
    weave = 9.0 * np.maximum(along * .42, across)
    # each thread keeps its own shade, and slubs break the regularity
    thread = gaussian_filter(rng.normal(size=(int(HEIGHT / pitch) + 2,)).astype('float32'), 1.2)
    rows = (Y[:, :1] / pitch).astype(int)
    weave += 2.6 * thread[rows] * across
    field = weave + clouds(rng, ((4, 2.2), (10, 1.2))) + .6 * normal(rng)
    field = gaussian_filter(field, (.45, .45))
    return compose([base[c] + field for c in range(3)])


def leather(rng):
    base = np.array([154, 104, 66], dtype='float32')
    spacing = 13
    points = rng.uniform((0, 0), (HEIGHT, WIDTH),
                         (round(HEIGHT / spacing) * round(WIDTH / spacing), 2))
    grid = np.dstack([Y, X]).reshape(-1, 2)
    dist, _ = cKDTree(points).query(grid, k=2)
    depth = dist[:, 0] / np.maximum(dist[:, 1], 1e-3)
    bowl = 1 - (2 * depth - 1) ** 2
    rim = np.exp(-((depth - .84) / .17) ** 2)
    pebble = (bowl * 4.2 - rim * 3.4).reshape(HEIGHT, WIDTH)
    pebble = gaussian_filter(pebble.astype('float32'), (.9, .9))
    field = pebble + clouds(rng, ((3, 3.4), (8, 2.0))) - specks(rng, 3.0, 6.0)
    field -= 6.0 * strokes(rng, 4, (.10, .30), width=2, blur=1.6)   # creases
    field += 3.5 * strokes(rng, 3, (.08, .20), width=2, blur=1.8)
    field += .6 * normal(rng)
    return compose([base[c] + field for c in range(3)])


def walnut(rng):
    base = np.array([104, 71, 48], dtype='float32')
    turbulence = gaussian_filter(normal(rng), (2.5, 34)) * 26
    rings = np.abs(((X * .052 + turbulence) % 2) - 1)        # 0 at growth line
    latewood = np.exp(-(rings ** 2) / .012)                   # dark growth lines
    field = 15 * rings - 30 * latewood
    field += gaussian_filter(normal(rng), (.4, 22)) * 3.6     # fine streaks
    field += clouds(rng, ((3, 2.6), (9, 1.4)))
    return compose([base[c] + field * (1 + .1 * c) for c in range(3)])


def slate(rng):
    base = np.array([62, 71, 80], dtype='float32')
    strata = gaussian_filter(normal(rng), (1, 130)) * 6.5
    strata += gaussian_filter(normal(rng), (1, 46)) * 3.0
    silky = gaussian_filter(normal(rng), (.35, 1.9)) * 2.4
    field = strata + silky + clouds(rng, ((4, 2.6), (10, 1.5)))
    field += specks(rng, 4.0, 26.0, blur=.35)                 # mica glints
    return compose([base[c] + field * (1.0 + .06 * (c - 1)) for c in range(3)])


def terrazzo(rng):
    base = np.array([231, 225, 213], dtype='float32')
    field = clouds(rng, ((4, 1.8), (10, 1.0)))
    chips = Image.new('RGB', (WIDTH, HEIGHT), (0, 0, 0))
    pen = ImageDraw.Draw(chips)
    palette = [(122, 126, 130), (161, 92, 70), (72, 74, 77), (183, 172, 150),
               (141, 111, 80), (99, 138, 148), (196, 178, 140)]
    for _ in range(620):
        cx, cy = rng.uniform(0, WIDTH), rng.uniform(0, HEIGHT)
        radius = rng.uniform(2.5, 13)
        pts = [(cx + radius * rng.uniform(-1, 1) * 1.5,
                cy + radius * rng.uniform(-1, 1)) for _ in range(7)]
        tone = tuple(int(v + rng.uniform(-10, 10)) for v in rng.choice(palette))
        pen.polygon(pts, fill=tone)
    chip = np.asarray(chips, dtype='float32')
    chip = gaussian_filter(chip, (0.5, 0.5, 0))
    field = field[..., None] + chip
    return compose([base[c] + field[..., c] for c in range(3)])


def chalkboard(rng):
    base = np.array([33, 36, 34], dtype='float32')
    field = clouds(rng, ((3, 4.2), (7, 2.6), (14, 1.6)))
    field += 5.5 * strokes(rng, 3, (.15, .4), width=3, blur=3.0)  # dusty smudges
    field += 2.5 * strokes(rng, 5, (.08, .2), width=2, blur=2.0)
    dust = np.abs(normal(rng)) * 2.0
    field += gaussian_filter(dust, (.4, .4))
    return compose([base[c] + field * (1.05 if c == 1 else 1.0) for c in range(3)])


def frosted(rng):
    base = np.array([222, 226, 229], dtype='float32')
    field = gaussian_filter(normal(rng), (42, 42)) * 15
    field += gaussian_filter(normal(rng), (15, 15)) * 6.5
    field += gaussian_filter(normal(rng), (26, 1.2)) * 3.2     # faint caustic drift
    bloom = np.abs(normal(rng)) * 3.4                          # etched bloom
    field += gaussian_filter(bloom, (.3, .3))
    return compose([base[c] + field * (1.0 - .04 * c) for c in range(3)])


MATERIALS = [
    ('cotton-paper', paper, False),
    ('limewash', limewash, False),
    ('concrete', concrete, False),
    ('linen', linen, False),
    ('bridle-leather', leather, True),
    ('walnut', walnut, True),
    ('slate', slate, True),
    ('terrazzo', terrazzo, False),
    ('chalkboard', chalkboard, True),
    ('frosted-glass', frosted, False),
]

if __name__ == '__main__':
    output = ROOT / 'public' / 'plate-options'
    output.mkdir(parents=True, exist_ok=True)
    for number, (slug, make, _) in enumerate(MATERIALS, start=22):
        rng = np.random.default_rng(700 + number)
        image = make(rng)
        image.save(output / f'opt-{number:02d}-{slug}.webp', quality=QUALITY, method=6)
        pixels = np.asarray(image, dtype='float32')
        print(f'opt-{number:02d} {slug:14} mean rgb',
              [round(float(pixels[..., c].mean())) for c in range(3)],
              'sd', round(float(pixels.std()), 1))
