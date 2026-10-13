<script lang="ts">
// Set once a wordmark has animated in this visit, so the app's later pages
// show it settled instead of replaying it on every navigation.
let animated = false
</script>

<script setup lang="ts">
// The Highreel wordmark (SPEC §6.4). LOGO in app/data/brand.ts picks which;
// scripts/brand.mjs draws the same shapes for the icons, the link preview and
// brand/ (tests/brand.test.ts keeps the two in step). Both are text, so they
// take the size, weight and colour of wherever they sit, and both animate the
// first time they show in a visit; `still` (footers), later pages of the
// same visit and reduced motion show them settled.
//
// 'capital-h' (since 2026-10-13): "Highreel" whose H has a blue play for a
// crossbar, fitted between its stems. The real "H" stays in the text,
// transparent, so the spacing is the font's own; two pseudo-elements draw over
// it in the letter's box (Outfit Bold, 1000 units to the em, the baseline
// 0.26em above the box's bottom): the stems (x 68–225 and 505–663, 706 tall)
// in the text colour, and the play (x 225–505, y -520 to -186, corners rounded
// 40) in the brand blue, popping in.
//
// 'highlighter' (2026-10-12): "highreel" with a marker stroke behind "high",
// drawn left to right.
import { LOGO } from '~/data/brand'

const props = defineProps<{ still?: boolean }>()
const animate = !props.still && !(import.meta.client && animated)
onMounted(() => {
  animated = true
})
</script>

<template>
  <span v-if="LOGO === 'capital-h'" class="hr-word" :class="{ 'hr-animate': animate }"><span class="hr-cap">H</span>ighreel</span>
  <span v-else class="hr-word" :class="{ 'hr-animate': animate }"><span class="hr-high">high</span>reel</span>
</template>

<style scoped>
/* --- Capital H ------------------------------------------------------------- */
.hr-cap {
  position: relative;
  /* Hides the letter's paint only: `color` stays, and the stems are drawn in it. */
  -webkit-text-fill-color: transparent;
}
.hr-cap::before,
.hr-cap::after {
  content: '';
  position: absolute;
}
/* The stems: scripts/brand.mjs's H_STEMS. */
.hr-cap::before {
  left: 0.068em;
  bottom: 0.26em;
  width: 0.595em;
  height: 0.706em;
  background: currentColor;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='68 -706 595 706'%3E%3Cpath d='M68 0V-706H225V0ZM505 0V-706H663V0Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='68 -706 595 706'%3E%3Cpath d='M68 0V-706H225V0ZM505 0V-706H663V0Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat;
}
/* The play: CAP_PLAY (stroked 2 × CAP_ROUND wide), cut out of its box. */
.hr-cap::after {
  left: 0.225em;
  bottom: 0.446em;
  width: 0.28em;
  height: 0.334em;
  background: var(--primary);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='225 -520 280 334'%3E%3Cpath d='M265 -480L265 -226L465 -353Z' stroke='%23000' stroke-width='80' stroke-linejoin='round'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='225 -520 280 334'%3E%3Cpath d='M265 -480L265 -226L465 -353Z' stroke='%23000' stroke-width='80' stroke-linejoin='round'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat;
  transform-origin: 10% 50%;
}
.hr-animate .hr-cap::after {
  animation: hr-play 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s backwards;
}
@keyframes hr-play {
  from { transform: scale(0.2); opacity: 0; }
  to { transform: none; opacity: 1; }
}

/* --- Highlighter ------------------------------------------------------------ */
.hr-high {
  position: relative;
  isolation: isolate;
}
/* The stroke sits behind "high" from just below the x-height to the baseline.
   Insets are in em from the text's box (Outfit: 1em above the baseline, 0.26em
   below), so it scales with the wordmark. The colour is `--marker`, a highlighter yellow. */
.hr-high::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0.624em -0.063em 0.226em -0.006em;
  background: var(--marker);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -376 1918 410' preserveAspectRatio='none'%3E%3Cpath d='M28 -338C640 -350 1260 -366 1874 -372C1890 -350 1880 -322 1896 -300C1906 -270 1884 -246 1898 -214C1910 -180 1886 -150 1900 -116C1910 -84 1890 -54 1902 -24C1270 -6 650 14 22 30C8 6 26 -24 10 -56C-2 -90 22 -120 8 -156C-4 -192 20 -222 6 -258C-4 -290 16 -318 28 -338Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -376 1918 410' preserveAspectRatio='none'%3E%3Cpath d='M28 -338C640 -350 1260 -366 1874 -372C1890 -350 1880 -322 1896 -300C1906 -270 1884 -246 1898 -214C1910 -180 1886 -150 1900 -116C1910 -84 1890 -54 1902 -24C1270 -6 650 14 22 30C8 6 26 -24 10 -56C-2 -90 22 -120 8 -156C-4 -192 20 -222 6 -258C-4 -290 16 -318 28 -338Z'/%3E%3C/svg%3E") 0 0 / 100% 100% no-repeat;
}
/* On dark, `--marker` is the brand blue (main.css): light letters on the yellow
   don't read, a toned-down yellow went muddy olive, and a white label behind
   the word was too heavy (owner, 2026-10-12). Only colours change between
   light and dark, so switching moves nothing. */
.hr-animate .hr-high::before {
  animation: hr-draw 0.7s cubic-bezier(0.55, 0, 0.25, 1) 0.25s backwards;
}
/* Both ends spelled out: a clip doesn't blend into `none`, it would jump. */
@keyframes hr-draw {
  from { clip-path: inset(0 100% 0 0); }
  to { clip-path: inset(0 0 0 0); }
}

@media (prefers-reduced-motion: reduce) {
  .hr-animate .hr-cap::after,
  .hr-animate .hr-high::before { animation: none; }
}
</style>
