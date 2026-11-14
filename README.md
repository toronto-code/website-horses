# Rupert Kahng

Run `npm install` and `npm run dev` for the portfolio and the live horse study at `/sprites`. Build both pages with `npm run build`.

The animated Horse is by Quaternius, from the [Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html), released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The bundled [glTF distribution](https://github.com/trebeljahr/quaternius-showcase/blob/main/public/glb/animals_pack/Horse.glb) provides the Gallop clip. The portfolio applies matte lighting and measured Times New Roman glyphs at runtime.

Generate the two PNG masters and five responsive WebP files with `python scripts/make-bg.py` using NumPy, SciPy and Pillow. PNG masters are kept in `art/steel`. The browser loads one matching WebP from `public/steel`.
