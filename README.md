# Rupert Kahng

Run `npm install` and `npm run dev` to open the portfolio. The stop-motion animation has a drawing viewer at `/horse-study/`. Run `npm run build` for a strict TypeScript check and a Vite production build.

## Stop-motion horse pose review

Run `npm run bake:poses` from the repository root. The bake samples 24 distinct times in the 0.583333-second gallop, including the start and excluding the duplicate endpoint. It writes the review sheet to `docs/review/pose-sheet.png` and the data atlas and measurements to `art/horse/gallop/`. The live renderer reads the atlas directly and uses the same 24 poses for every horse.

The source is Quaternius’s **Horse** from the **Ultimate Animated Animal Pack**, dedicated to the public domain under CC0 1.0. The verified binary contains a 50-joint skin and the clip named exactly `AnimalArmature|Gallop`. The pack-specific license appears on the creator’s page. The vendored file matches Git blob `c93b598005fd4a6163f12782eeb31b10b6e4bc48` in the glTF distribution. [Creator and pack](https://quaternius.com/packs/ultimateanimatedanimals.html) · [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) · [Pinned model](https://github.com/trebeljahr/quaternius-showcase/blob/0128ca510d653bb04d6d1e4885bd8890b5050b4f/public/glb/animals_pack/Horse.glb)

The native clip meets the motion thresholds. Its widest reach has less than one pixel of ground clearance at the review scale. The bake adds two root lifts per stride, a suspension pitch, a head nod, and extra reach at the projecting legs. Foreleg and hind-leg corrections carry the separate hoof IK chains with them. A periodic damped-spring response adds tail follow-through. The model’s mane is weighted to the neck chain, which receives a smaller lagged turn.

| Peak-to-peak measurement | Original clip | Review bake |
| --- | ---: | ---: |
| Vertical travel of torso centroid, as a fraction of maximum posed height | 4.66% | 8.48% |
| Torso pitch | 12.34° | 11.41° |
| Neck pitch | 22.75° | 18.89° |
| Head pitch | 14.15° | 12.38° |

The camera uses a fixed orthographic projection looking along the X axis, with +Z to the right and +Y up. Torso bob uses the surface-area-weighted centroid of skinned torso triangles with at least 75% mean torso-bone influence, excluding hair. The normalization height is the tallest single baked silhouette. Pitch measurements use the pelvis-to-withers, neck-base-to-poll, and poll-to-muzzle axes in side view. The neck also swings 12.07° relative to the torso. Per-pose world-space measurements, camera scale and ground line are in `poses.json`.

The atlas has six columns and four rows of 640 × 320 frames, ordered left to right. Its red channel holds unassociated ink density, green holds antialiased silhouette coverage and blue is zero. The bake reserves at least 77 pixels to the left of the silhouette. The review sheet shows the same silhouettes in matte grayscale. Frame 22 is extended flight, with 29.6 pixels of clearance under the lowest hoof. Frame 12 has the smallest longitudinal hoof spread.

## Stop-motion ink

Each horse has its own exposure clock. At the default 10 drawings per second, an idle stride takes eight drawings and travels 0.74 horse lengths. Scrolling advances four poses per exposure and increases the ground step in the same proportion. The lightweight animation loop checks deadlines. An exposure redraws just the horse whose clock fired, and its canvas holds that position and drawing until the next tick. The bob comes from the baked skeleton. Desktop shows three lanes and portrait shows two. Reduced motion holds the extended-flight drawing.

Set the URL parameter `?drawnFps=8` through `?drawnFps=12` to change the drawing clock. The frame viewer at `/horse-study/` uses the same clock, poses and ink renderer. Its 24 drawings cover three idle strides.

The brush is a small pressure mask sampled from an actual horizontal mark on the supplied reference's tail. Run `node tools/bake-horse/nib.mjs` to extract it again. For each exposure the ink renderer samples the projected silhouette and lighting, changes the distribution of long and short marks, and varies the registration, smear and dust. The contour emerges from overlapping feathered strokes. The measured redraw times and pixel differences are in `docs/review/stopmotion-metrics.json`; the 16 consecutive browser captures are assembled in `docs/review/stopmotion-sheet.png`.

## Tools

Vite serves and builds the pages. TypeScript checks the browser code. Three.js loads and skins the rig during the offline pose bake. Sharp downsamples the rendered data, writes the atlas and lays out the review sheet. Three.js and Sharp run only during development.

The earlier source-image frame bake is available through `npm run bake:horse` and uses the supplied horse drawing at `reference/horse-scratch.png`. Generate the fixed plate assets with `npm run bake:plate` using Python, NumPy, SciPy and Pillow.
