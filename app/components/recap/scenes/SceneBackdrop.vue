<script setup lang="ts">
// Behind every slide (SPEC M2.5 P1). Stories: soft colour blobs from the
// palette drift slowly, over a fine grain. Paper: paper grain and two ink
// rules that draw in. Static SVG noise, transforms only.
import type { SlideTone } from '#shared/utils/slides'
import type { Tone } from '#shared/utils/color'
import { mix } from '#shared/utils/color'

const props = withDefaults(defineProps<{
  tone: Tone
  toneName: SlideTone
  accent: string
  paper: boolean
  /** layout of the blobs, by slide position */
  variant: number
  blobs?: boolean
}>(), { blobs: true })

const colours = computed(() => {
  const { bg, hi } = props.tone
  const a = props.accent
  if (props.toneName === 'accent')
    return [mix('#FFFFFF', bg, 0.3), mix('#000000', bg, 0.22), mix('#FFFFFF', bg, 0.14)]
  if (props.toneName === 'dark')
    return [mix(a, bg, 0.75), mix(a, bg, 0.45), mix(hi, bg, 0.3)]
  return [mix(a, bg, 0.34), mix('#FFFFFF', bg, 0.8), mix(a, bg, 0.2)]
})

// Three compositions, so consecutive slides don't look the same.
const LAYOUTS = [
  [{ x: 62, y: -8, s: 92 }, { x: -30, y: 58, s: 74 }, { x: 40, y: 96, s: 60 }],
  [{ x: -24, y: -4, s: 84 }, { x: 58, y: 44, s: 88 }, { x: -10, y: 110, s: 56 }],
  [{ x: 30, y: 20, s: 100 }, { x: -36, y: -14, s: 60 }, { x: 64, y: 100, s: 70 }],
]
const blobList = computed(() => LAYOUTS[props.variant % LAYOUTS.length]!.map((b, i) => ({
  left: `calc(${b.x} * var(--u))`,
  top: `calc(${b.y} * var(--u))`,
  width: `calc(${b.s} * var(--u))`,
  height: `calc(${b.s} * var(--u))`,
  background: `radial-gradient(closest-side, ${colours.value[i]}, ${colours.value[i]}00)`,
})))
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <template v-if="paper">
      <span class="grain paper-grain" />
      <span class="rule rule-h" />
      <span class="rule rule-v" />
    </template>
    <template v-else>
      <div v-if="blobs" class="blobs">
        <span v-for="(b, i) in blobList" :key="i" class="blob" :class="`blob-${i}`" :style="b" />
      </div>
      <span class="grain" />
    </template>
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.blobs {
  position: absolute;
  inset: 0;
  animation: blobs-in 1200ms var(--ease-out) both;
}
.blob {
  position: absolute;
  border-radius: 50%;
  will-change: transform;
}
.blob-0 { animation: drift-0 17s ease-in-out infinite alternate; }
.blob-1 { animation: drift-1 21s ease-in-out infinite alternate; }
.blob-2 { animation: drift-2 14s ease-in-out infinite alternate; }
@keyframes blobs-in {
  from { opacity: 0; transform: scale(0.85); }
}
@keyframes drift-0 {
  to { transform: translate(calc(-9 * var(--u)), calc(7 * var(--u))) scale(1.1); }
}
@keyframes drift-1 {
  to { transform: translate(calc(8 * var(--u)), calc(-9 * var(--u))) scale(0.92); }
}
@keyframes drift-2 {
  to { transform: translate(calc(6 * var(--u)), calc(-6 * var(--u))) scale(1.14); }
}
.grain {
  position: absolute;
  inset: 0;
  /* The filter reference is url%28%23n%29, not url(%23n): the same SVG once decoded, but the
     image capture for "Save images" (M2.13) read a literal url( inside the data URI as a file to fetch. */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url%28%23n%29'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  opacity: 0.22;
  mix-blend-mode: overlay;
}
.paper-grain {
  opacity: 0.32;
  mix-blend-mode: multiply;
}
.rule {
  position: absolute;
  background: currentColor;
  opacity: 0.14;
}
.rule-h {
  left: calc(8 * var(--u));
  right: calc(8 * var(--u));
  bottom: calc(15 * var(--u));
  height: 1px;
  transform-origin: left;
  animation: rule-x 900ms var(--ease-out) 200ms both;
}
.rule-v {
  top: 0;
  bottom: 0;
  left: calc(4 * var(--u));
  width: 1px;
  transform-origin: top;
  animation: rule-y 1100ms var(--ease-out) 100ms both;
}
@keyframes rule-x {
  from { transform: scaleX(0); }
}
@keyframes rule-y {
  from { transform: scaleY(0); }
}
</style>
