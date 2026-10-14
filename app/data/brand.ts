// Which logo the site uses (SPEC §6.4). Both are drawn in Wordmark.vue (the
// site's wordmark) and scripts/brand.mjs (icons, the link preview, brand/).
// Switching is this one line, then `node scripts/icons.mjs` and
// `node scripts/og-landing.mjs` to redraw the icons and the link preview
// (then bump OG_IMAGE below).
//   'highlighter'  "highreel" with a marker stroke behind "high" (since 2026-10-12)
//   'capital-h'    "Highreel" whose capital H has a blue play for a crossbar
//                  (tried 2026-10-13; kept, not in use)
export type Logo = 'capital-h' | 'highlighter'
export const LOGO: Logo = 'highlighter'

/**
 * The public pages' link preview (public/og.png, drawn by
 * scripts/og-landing.mjs). Chat apps and social sites keep a preview by its
 * address, so bump `v` whenever the picture is redrawn.
 */
export const OG_IMAGE = '/og.png?v=3'
