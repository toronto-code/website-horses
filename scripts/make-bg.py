#!/usr/bin/env python3
"""Bake the two steel surfaces. Requires numpy, scipy and Pillow."""
from pathlib import Path
import argparse
import math

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, zoom

ROOT = Path(__file__).resolve().parents[1]
SEED = 71312
SUPERSAMPLE = 4
MIN_TONE = 124 / 255


def low_frequency(rng, height, width, sigma):
    # Filtering at 1/8 scale gives the same physical correlation lengths.
    shape = (math.ceil(height / 8), math.ceil(width / 8))
    noise = gaussian_filter(rng.standard_normal(shape).astype('f'), sigma / 8, mode='reflect')
    noise -= noise.mean()
    noise /= max(noise.std(), 1e-9)
    return zoom(noise, (height / shape[0], width / shape[1]), order=1)


def scratches(surface, rng, count, wear):
    height, width = surface.shape
    scale = SUPERSAMPLE
    done = 0
    while done < count:
        x, y = rng.uniform(0, width), rng.uniform(0, height)
        if rng.random() > wear[int(y), int(x)]:
            continue
        done += 1
        length = np.clip(rng.lognormal(math.log(45), .88), 5, 600)
        angle = rng.uniform(-12, 12) - 24 if rng.random() < .6 else rng.uniform(-180, 180)
        direction = np.array([math.cos(math.radians(angle)), math.sin(math.radians(angle))])
        normal = np.array([-direction[1], direction[0]])
        width_px = rng.uniform(.6, 1.6)
        bend = rng.uniform(-.05, .05)*length if rng.random() < .2 else 0
        t = np.linspace(0, 1, 17)[:, None]
        centre = [x, y] + (t-.5)*length*direction + (4*t*(1-t))*bend*normal
        # A narrow tapered end and a little irregularity keep each cut distinct.
        radius = width_px*.5*(.12+.88*np.sin(t*np.pi)**.50)*rng.uniform(.87, 1.13, (17, 1))
        outline = np.concatenate([centre+radius*normal, (centre-radius*normal)[::-1]])
        lo = np.maximum(0, np.floor(outline.min(axis=0)-2).astype(int))
        hi = np.minimum([width,height], np.ceil(outline.max(axis=0)+3).astype(int))
        size = hi-lo
        mask = Image.new('L', tuple(size*scale))
        ImageDraw.Draw(mask).polygon([tuple(p) for p in (outline-lo)*scale], fill=255)
        coverage = np.asarray(mask.resize(tuple(size), Image.Resampling.LANCZOS), dtype='f')/255
        intensity = .03 + .15*rng.random()**3.8
        if rng.random() >= .70:
            intensity *= -1
        surface[lo[1]:hi[1],lo[0]:hi[0]] += intensity*coverage


def bake(width, height, seed):
    rng = np.random.default_rng(seed)
    surface = np.full((height,width), .55, dtype='f')
    for sigma, amplitude in [(200,.025),(80,.015),(30,.008)]:
        noise = low_frequency(rng,height,width,sigma)
        # Bounded noise avoids broad stain-like excursions across the plate.
        surface += np.tanh(noise*.43)*amplitude
    grain = rng.normal(0,.012,surface.shape).astype('f')
    surface += gaussian_filter(grain, .6)
    wear = .58 + .29*np.tanh(low_frequency(rng,height,width,155))
    scratches(surface,rng,round(width*height*.00103),wear)
    for _ in range(round(width*height*.00009)):
        x = rng.integers(4,width-4)
        y = rng.integers(4,height-4)
        radius = rng.uniform(.55,1.5)
        dy, dx = np.mgrid[-3:4,-3:4]
        core = np.exp(-(dx**2+dy**2)/(radius**2*.7))
        lip = np.exp(-((dx+.8)**2+(dy+.8)**2)/(radius**2*.6))
        surface[y-3:y+4,x-3:x+4] += .023*lip-rng.uniform(.05,.12)*core
    surface += .55-surface.mean()
    return Image.fromarray(np.rint(255*np.clip(surface,MIN_TONE,.745)).astype('uint8'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'public'/'steel')
    parser.add_argument('--masters',type=Path,default=ROOT/'art'/'steel')
    args = parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    args.masters.mkdir(parents=True,exist_ok=True)
    for name, dims, widths, seed in [
        ('landscape',(2560,1440),(2560,1600,960),SEED),
        ('portrait',(1080,1920),(1080,720),SEED+1),
    ]:
        master = bake(*dims,seed)
        master.save(args.masters/f'{name}.png',optimize=True)
        for width in widths:
            size = (width,round(master.height*width/master.width))
            img = master if size==master.size else master.resize(size,Image.Resampling.LANCZOS)
            # Preserve the tone floor through resampling and codec round trips.
            img = Image.fromarray(np.maximum(np.asarray(img), round(MIN_TONE*255)))
            img.save(args.output/f'{name}-{width}.webp',lossless=True,quality=95,method=6)
        print(name, 'mean',np.asarray(master).mean(),'quantiles',np.percentile(master,[0,.5,2,50,98,99.5,100]))

if __name__ == '__main__':
    main()
