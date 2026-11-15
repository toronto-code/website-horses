# Rupert Kahng

Run `npm install` and `npm run dev` to open the portfolio. The stop-motion animation has a drawing viewer at `/horse-study/`. Run `npm run build` for a strict TypeScript check and a Vite production build.

## Stop-motion horse pose review

Run `npm run bake:poses` from the repository root. The active gait is the approved collected gallop from the mockup, with shorter backward hip extension and a more compact recovery. Its 60 source poses, fixed camera and motion measurements live in `art/horse/collected/`; `key-poses.jpg` shows representative poses. The website samples every sixth pose at ten drawings per second, preserving the approved held-drawing cadence.

The source is Quaternius’s **Horse** from the **Ultimate Animated Animal Pack**, dedicated to the public domain under CC0 1.0. The verified binary contains a 50-joint skin and the clip named exactly `AnimalArmature|Gallop`. The pack-specific license appears on the creator’s page. The vendored file matches Git blob `c93b598005fd4a6163f12782eeb31b10b6e4bc48` in the glTF distribution. [Creator and pack](https://quaternius.com/packs/ultimateanimatedanimals.html) · [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) · [Pinned model](https://github.com/trebeljahr/quaternius-showcase/blob/0128ca510d653bb04d6d1e4885bd8890b5050b4f/public/glb/animals_pack/Horse.glb)

The collected-gallop bake keeps the rig's authored footfalls, compresses backward hip extension smoothly, and uses one constant floor offset to preserve the body bob. The separate hoof chains follow their corrected shins. All horses use the same 60-pose atlas, arranged as ten columns and six rows of 640 × 320 frames. Red holds unassociated ink density, green holds antialiased silhouette coverage and blue is unused. The camera remains orthographic, with +Z right and +Y up.

The earlier 24-pose expanded-flight version and its measurements remain in `art/horse/gallop/`. Regenerate it with `npm run bake:poses:original`. It is kept in reserve and is not the live atlas.

## Stop-motion ink

Each horse has its own exposure clock. At the default 10 drawings per second, an idle stride takes ten drawings and travels about 0.76 horse lengths. Scrolling advances eight source poses per exposure and increases the ground step in the same proportion. The lightweight animation loop checks deadlines. An exposure redraws just the horse whose clock fired, and its canvas holds that position and drawing until the next tick. The bob comes from the baked skeleton. Desktop shows three lanes and portrait shows two. Reduced motion holds a single collected drawing.

Set the URL parameter `?drawnFps=8` through `?drawnFps=12` to change the drawing clock. The frame viewer at `/horse-study/` uses the same clock, poses and ink renderer. Its 30 drawings cover three idle strides, and the sequence shows all ten drawings of one stride.

The brush is a small pressure mask sampled from an actual horizontal mark on the supplied reference's tail. Run `node tools/bake-horse/nib.mjs` to extract it again. For each exposure the ink renderer samples the projected silhouette and lighting, changes the distribution of long and short marks, and varies the registration, smear and dust. The contour emerges from overlapping feathered strokes. The measured redraw times and pixel differences are in `docs/review/stopmotion-metrics.json`; the 16 consecutive browser captures are assembled in `docs/review/stopmotion-sheet.png`.

## Tools

The homepage name uses the approved **04 · Rounded** mockup in flat black. `public/lettering/rupert-kahng-rounded.svg` contains the selected letter outlines traced from the supplied alphabet, preserving their shapes and spacing without a substitute font. The wordmark scales with the responsive heading; semantic text remains available to assistive technology and becomes visible in forced colors. Other section headings retain their existing raised lettering. The previous Serial stamp artwork and renderer remain in reserve at `art/service-silver/serial-stamp-source.png`, `public/service-silver/serial-stamp.webp`, and `src/emboss/stamp.ts`.

Vite serves and builds the pages. TypeScript checks the browser code. Three.js loads and skins the rig during the offline pose bake. Sharp downsamples the rendered data, writes the atlas and lays out the review sheet. Three.js and Sharp run only during development.

The earlier source-image frame bake is available through `npm run bake:horse` and uses the supplied horse drawing at `reference/horse-scratch.png`. The current background is the Service silver finish selected from the aviation mockups: its original texture is preserved at `art/service-silver/source.png`, with responsive WebP assets in `public/service-silver/`. The previous Mercury finish remains in `art/mercury/` and `public/mercury/`. The older brushed plate can still be generated with `npm run bake:plate` using Python, NumPy, SciPy and Pillow.
