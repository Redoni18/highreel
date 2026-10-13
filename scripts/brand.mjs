// The Highreel logos as SVG (SPEC §6.4), for icons.mjs (the site's icons and
// the brand/ files) and og-landing.mjs (the link preview). LOGO in
// app/data/brand.ts picks the site's; Wordmark.vue draws the same shapes on
// the site (tests/brand.test.ts keeps the two in step).
//
// Outlines are Outfit Bold (scripts/fonts, OFL), copied out with fontTools so
// no font is needed: 1000 units to the em, y down, baseline at 0, the first
// letter's origin at x 0. "highreel" is set like the site sets it:
// letter-spacing -0.035em and Outfit's r–e kerning.

import { LOGO } from '../app/data/brand.ts'

export { LOGO }

/** Outfit Bold "h": x 54–528, y -726–0. */
export const H = 'M375 0V-277Q375 -315 351.5 -338.5Q328 -362 292 -362Q267 -362 248 -351.5Q229 -341 218 -321.5Q207 -302 207 -277L148 -306Q148 -363 172 -406Q196 -449 239 -472.5Q282 -496 338 -496Q395 -496 438 -472.5Q481 -449 504.5 -407.5Q528 -366 528 -311V0ZM54 0V-726H207V0Z'

/** "highreel": x 54–3460, y -726 (ascenders) to 218 (the g). */
export const WORD = 'M375 0V-277Q375 -315 351.5 -338.5Q328 -362 292 -362Q267 -362 248 -351.5Q229 -341 218 -321.5Q207 -302 207 -277L148 -306Q148 -363 172 -406Q196 -449 239 -472.5Q282 -496 338 -496Q395 -496 438 -472.5Q481 -449 504.5 -407.5Q528 -366 528 -311V0ZM54 0V-726H207V0ZM591 0V-486H744V0ZM668 -553Q632 -553 608.5 -577.5Q585 -602 585 -637Q585 -673 608.5 -697Q632 -721 668 -721Q704 -721 727 -697Q750 -673 750 -637Q750 -602 727 -577.5Q704 -553 668 -553ZM1023 218Q943 218 882.5 190.5Q822 163 787 113L881 19Q907 50 939.5 66Q972 82 1018 82Q1075 82 1107.5 54Q1140 26 1140 -25V-149L1166 -255L1143 -361V-486H1293V-29Q1293 46 1258 101Q1223 156 1162 187Q1101 218 1023 218ZM1016 -15Q949 -15 897 -47Q845 -79 815 -134Q785 -189 785 -256Q785 -324 815 -378.5Q845 -433 897 -464.5Q949 -496 1016 -496Q1066 -496 1105.5 -477.5Q1145 -459 1169.5 -425.5Q1194 -392 1197 -348V-163Q1194 -120 1169.5 -86.5Q1145 -53 1105 -34Q1065 -15 1016 -15ZM1045 -151Q1077 -151 1100.5 -165Q1124 -179 1136.5 -202.5Q1149 -226 1149 -256Q1149 -286 1136.5 -310Q1124 -334 1100.5 -348Q1077 -362 1045 -362Q1014 -362 990 -348Q966 -334 953 -310Q940 -286 940 -256Q940 -228 953 -203.5Q966 -179 989.5 -165Q1013 -151 1045 -151ZM1687 0V-277Q1687 -315 1663.5 -338.5Q1640 -362 1604 -362Q1579 -362 1560 -351.5Q1541 -341 1530 -321.5Q1519 -302 1519 -277L1460 -306Q1460 -363 1484 -406Q1508 -449 1551 -472.5Q1594 -496 1650 -496Q1707 -496 1750 -472.5Q1793 -449 1816.5 -407.5Q1840 -366 1840 -311V0ZM1366 0V-726H1519V0ZM1903 0V-486H2056V0ZM2056 -267 1992 -317Q2011 -402 2056 -449Q2101 -496 2181 -496Q2216 -496 2242.5 -485.5Q2269 -475 2289 -453L2198 -338Q2188 -349 2173 -355Q2158 -361 2139 -361Q2101 -361 2078.5 -337.5Q2056 -314 2056 -267ZM2521 11Q2442 11 2380.5 -21.5Q2319 -54 2284 -112Q2249 -170 2249 -243Q2249 -316 2283.5 -373.5Q2318 -431 2377 -464Q2436 -497 2510 -497Q2582 -497 2637 -466Q2692 -435 2723.5 -380Q2755 -325 2755 -254Q2755 -241 2753.5 -226.5Q2752 -212 2748 -193L2329 -192V-297L2683 -298L2617 -254Q2616 -296 2604 -323.5Q2592 -351 2568.5 -365.5Q2545 -380 2511 -380Q2475 -380 2448.5 -363.5Q2422 -347 2407.5 -317Q2393 -287 2393 -244Q2393 -201 2408.5 -170.5Q2424 -140 2452.5 -123.5Q2481 -107 2520 -107Q2556 -107 2585 -119.5Q2614 -132 2636 -157L2720 -73Q2684 -31 2633 -10Q2582 11 2521 11ZM3034 11Q2955 11 2893.5 -21.5Q2832 -54 2797 -112Q2762 -170 2762 -243Q2762 -316 2796.5 -373.5Q2831 -431 2890 -464Q2949 -497 3023 -497Q3095 -497 3150 -466Q3205 -435 3236.5 -380Q3268 -325 3268 -254Q3268 -241 3266.5 -226.5Q3265 -212 3261 -193L2842 -192V-297L3196 -298L3130 -254Q3129 -296 3117 -323.5Q3105 -351 3081.5 -365.5Q3058 -380 3024 -380Q2988 -380 2961.5 -363.5Q2935 -347 2920.5 -317Q2906 -287 2906 -244Q2906 -201 2921.5 -170.5Q2937 -140 2965.5 -123.5Q2994 -107 3033 -107Q3069 -107 3098 -119.5Q3127 -132 3149 -157L3233 -73Q3197 -31 3146 -10Q3095 11 3034 11ZM3307 0V-726H3460V0Z'

/** "ighreel": the word after its h. */
export const REST = WORD.slice(H.length)

export const INK = '#222222'
export const BLUE = '#4560FF'

const svg = (viewBox, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>\n`
/** A rounded triangle: `d` stroked 2r wide with round joins, so its corners are rounded r. */
const rounded = (d, r, fill) => `<path d="${d}" fill="${fill}" stroke="${fill}" stroke-width="${2 * r}" stroke-linejoin="round"/>`

// --- Capital H (since 2026-10-13) ----------------------------------------------
// A capital H whose crossbar is a blue play, fitted between its stems: the
// owner's idea, round 3 on the logo canvas (an earlier, bigger play ran into
// both stems). Then "ighreel", so the word reads "Highreel".

/** Outfit Bold "H" without its crossbar: stems x 68–225 and 505–663, 706 tall. */
export const H_STEMS = 'M68 0V-706H225V0ZM505 0V-706H663V0Z'
/**
 * The play fills the gap between the stems, x 225–505, and y -520 to -186
 * (334 tall, centred on the cap height), with corners rounded CAP_ROUND: its
 * flat side against the left stem, its tip touching the right one.
 */
export const CAP_ROUND = 40
export const CAP_PLAY = `M${225 + CAP_ROUND} ${-520 + CAP_ROUND}L${225 + CAP_ROUND} ${-186 - CAP_ROUND}L${505 - CAP_ROUND} -353Z`
/** "H" is 158 units wider than "h" (730 against 572), so the rest of the word moves right. */
export const CAP_SHIFT = 158

const capGlyph = (ink, play) => `<path d="${H_STEMS}" fill="${ink}"/>${rounded(CAP_PLAY, CAP_ROUND, play)}`
const capWord = (ink, play) => `${capGlyph(ink, play)}<path d="${REST}" fill="${ink}" transform="translate(${CAP_SHIFT} 0)"/>`
// The icon: the H centred in the 512 square (x 68–663, y -706–0), white,
// with the play in the landing's marigold: a white play between white stems
// merged into one shape at tab size (owner, 2026-10-13: make the H bigger and
// the play noticeable). Scale 0.5 makes it 353 tall (69 % of the square); the
// app icon's 0.42 keeps its corners inside round masks' middle 80 %.
export const MARIGOLD = '#FFB43A'
const capIcon = scale => `<g transform="translate(${256 - 365.5 * scale} ${256 + 353 * scale}) scale(${scale})">${capGlyph('#FFFFFF', MARIGOLD)}</g>`
// The ink, x 68–3618, with 40 units of air around it.
const CAP_VIEWBOX = '28 -766 3630 1024'

// --- Highlighter (2026-10-12 to 2026-10-13) --------------------------------------
// "highreel" with a rough highlighter-yellow marker stroke behind "high". The
// icon is a highlighted "h": "half" (the site's while it was the logo), a
// stroke behind the lower half of an ink "h" on a white rounded square, or
// "full", the whole "h" on a marker dab.

/** The marker stroke behind "high": x -6–1912, y -376–34 (Wordmark.vue's mask box). */
export const STROKE = 'M28 -338C640 -350 1260 -366 1874 -372C1890 -350 1880 -322 1896 -300C1906 -270 1884 -246 1898 -214C1910 -180 1886 -150 1900 -116C1910 -84 1890 -54 1902 -24C1270 -6 650 14 22 30C8 6 26 -24 10 -56C-2 -90 22 -120 8 -156C-4 -192 20 -222 6 -258C-4 -290 16 -318 28 -338Z'
export const STROKE_BOX = { x: -6, y: -376, w: 1918, h: 410 }

/** The "full" icon's marker dab, a rough square in a 512 box (x 46–466, y 70–452). */
export const DAB = 'M70 96C160 84 300 78 430 70C446 92 436 118 450 144C462 176 440 206 452 240C464 276 442 306 454 342C466 378 444 406 446 440C320 448 190 452 66 448C56 420 74 392 60 362C48 330 70 300 58 268C46 236 68 206 56 174C46 142 66 120 70 96Z'

// Highlighter yellow: light enough to sit behind ink without fighting it
// (also `--marker` in main.css). On dark backgrounds the stroke is the brand
// blue (light letters on yellow don't read). The icon's stroke is a shade
// deeper and bigger, so it shows at 16 px.
export const MARKER = '#FFE45C'
export const ICON_MARKER = '#FFD93B'
export const STROKE_H = 'M-87 -426C166 -439 419 -457 669 -470C687 -441 674 -405 692 -371C705 -332 679 -295 695 -253C708 -212 682 -173 697 -131C710 -89 685 -50 700 -8C703 15 692 31 695 44C434 52 171 62 -95 70C-110 41 -89 7 -105 -32C-118 -71 -92 -110 -107 -152C-120 -193 -95 -233 -110 -274C-123 -316 -97 -355 -110 -392C-115 -410 -95 -420 -87 -426Z'

const fullBody = `<path d="${DAB}" fill="${MARKER}"/><path d="${H}" fill="${INK}" transform="translate(147.8 391) scale(0.3719)"/>`
const halfBody = `<g transform="translate(71 469.75) scale(0.625)"><path d="${STROKE_H}" fill="${ICON_MARKER}"/><path d="${H}" fill="${INK}"/></g>`
// The ink and the stroke, 40 units of air around them.
const WORD_VIEWBOX = '-46 -766 3546 1024'

// --- The logos ------------------------------------------------------------------

/**
 * Each logo's files. `icons`/`appIcons`: 512 boxes; app icons fill the square
 * (iOS and round masks crop it) and keep the mark inside the middle 80 %.
 * `siteIcon` is the one the site uses. `place(cx, y, size)` draws the
 * wordmark centred on cx with its baseline at y, `size` px to the em.
 */
export const logos = {
  'capital-h': {
    icons: { icon: svg('0 0 512 512', `<rect width="512" height="512" rx="116" fill="${BLUE}"/>${capIcon(0.5)}`) },
    appIcons: { icon: svg('0 0 512 512', `<rect width="512" height="512" fill="${BLUE}"/>${capIcon(0.42)}`) },
    siteIcon: 'icon',
    wordmark: svg(CAP_VIEWBOX, capWord(INK, BLUE)),
    wordmarkWhite: svg(CAP_VIEWBOX, capWord('#FFFFFF', BLUE)),
    aspect: 3630 / 1024,
    place: (cx, y, size) => `<g transform="translate(${cx - ((68 + 3618) / 2) * size / 1000} ${y}) scale(${size / 1000})">${capWord(INK, BLUE)}</g>`,
  },
  'highlighter': {
    icons: {
      'icon-half': svg('0 0 512 512', `<rect width="512" height="512" rx="68" fill="#FFFFFF"/><g transform="translate(37.6 37.6) scale(0.853)">${halfBody}</g>`),
      'icon-full': svg('0 0 512 512', fullBody),
    },
    appIcons: {
      'icon-half': svg('0 0 512 512', `<rect width="512" height="512" fill="#FFFFFF"/><g transform="translate(89.6 89.6) scale(0.65)">${halfBody}</g>`),
      'icon-full': svg('0 0 512 512', `<rect width="512" height="512" fill="#FFFFFF"/><g transform="translate(76.8 76.8) scale(0.7)">${fullBody}</g>`),
    },
    siteIcon: 'icon-half',
    wordmark: svg(WORD_VIEWBOX, `<path d="${STROKE}" fill="${MARKER}"/><path d="${WORD}" fill="${INK}"/>`),
    wordmarkWhite: svg(WORD_VIEWBOX, `<path d="${STROKE}" fill="${BLUE}"/><path d="${WORD}" fill="#FFFFFF"/>`),
    /** Draws the stroke left to right once, like the site (SMIL, so it plays in an <img> too); still renderers show it drawn. */
    wordmarkAnimated: svg(WORD_VIEWBOX, `<defs><clipPath id="draw"><rect x="${STROKE_BOX.x}" y="${STROKE_BOX.y}" width="${STROKE_BOX.w}" height="${STROKE_BOX.h}"><animate attributeName="width" values="0;0;${STROKE_BOX.w}" keyTimes="0;0.26;1" dur="0.95s" calcMode="spline" keySplines="0 0 1 1;0.55 0 0.25 1" fill="freeze"/></rect></clipPath></defs><path d="${STROKE}" fill="${MARKER}" clip-path="url(#draw)"/><path d="${WORD}" fill="${INK}"/>`),
    aspect: 3546 / 1024,
    place: (cx, y, size) => `<g transform="translate(${cx - ((54 + 3460) / 2) * size / 1000} ${y}) scale(${size / 1000})"><path d="${STROKE}" fill="${MARKER}"/><path d="${WORD}" fill="${INK}"/></g>`,
  },
}

/** The site's logo. */
export const siteLogo = logos[LOGO]
