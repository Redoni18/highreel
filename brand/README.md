# Highreel logos

Written by `node scripts/icons.mjs` from `scripts/brand.mjs`; don't edit by hand.

- `capital-h/`: a capital H whose crossbar is a blue play, fitted between its
  stems, then "ighreel" (since 13 October 2026).
- `highlighter/`: "highreel" with a highlighter-yellow stroke behind "high"
  (12 to 13 October 2026). Icons: `icon-half` (the one the site used) and
  `icon-full`; `highreel-wordmark-animated.svg` draws the stroke once.

Each folder has the wordmark for light backgrounds and `-white` for dark
ones (SVG, and PNG 2400 px wide), the icon (SVG, PNG 512 and 1024, favicon
.ico) and the app icon (SVG, PNG 1024).

The site uses `highlighter`. To switch: set `LOGO` in `app/data/brand.ts`, then run
`node scripts/icons.mjs` and `node scripts/og-landing.mjs`. The site's wordmark
(`app/components/Wordmark.vue`) follows the same setting.
