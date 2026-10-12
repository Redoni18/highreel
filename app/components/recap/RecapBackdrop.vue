<script setup lang="ts">
// Behind the phone on the recap page, on screens wide enough to show it as a
// frame (SPEC M2.8): the landing's ambient motion in the business's colours.
// Soft blobs that keep changing shape (SMIL, so Safari morphs too) and turn
// slowly, a few hand-drawn lines that draw in and let go, small pieces
// floating. CSS and SVG only; it holds still for reduced motion.
import { blobFrames } from '~/lib/blobs'
import { mix, shiftHue } from '#shared/utils/color'

const props = defineProps<{ accent: string, paper?: boolean }>()

// The accent, two neighbours on the colour wheel and a light and a deep
// version of it: playful, and still the business's own.
const colors = computed(() => {
  const a = props.accent
  return [a, mix(shiftHue(a, 42), '#FFFFFF', 0.9), mix(shiftHue(a, -48), '#FFFFFF', 0.85), mix(a, '#FFFFFF', 0.45), mix(a, '#0A0A0A', 0.7)]
})
const base = computed(() => (props.paper ? mix(props.accent, '#F4F1EA', 0.07) : mix(props.accent, '#FFFFFF', 0.13)))

const EASE = Array(4).fill('0.45 0 0.55 1').join(';')
// Spots in % of the page, sizes in vmin: the edges, around the frame in the middle.
const blobs = [
  { c: 0, x: 11, y: 24, s: 30, seed: 3, dur: 16 },
  { c: 1, x: 90, y: 15, s: 24, seed: 7, dur: 13 },
  { c: 2, x: 91, y: 80, s: 34, seed: 11, dur: 18 },
  { c: 3, x: 7, y: 83, s: 22, seed: 5, dur: 14 },
  { c: 4, x: 24, y: 104, s: 18, seed: 13, dur: 12 },
].map(b => ({ ...b, frames: blobFrames(b.seed) }))
const lines = [
  { d: 'M8 70C38 18 62 112 96 62S150 12 192 58', c: 2, x: 20, y: 44, s: 20, r: -14, delay: 0 },
  { d: 'M10 80C60 90 90 60 82 36S40 18 46 50 100 96 130 70 168 24 190 40', c: 0, x: 80, y: 58, s: 20, r: 6, delay: 2.3 },
  { d: 'M12 96Q100 -4 188 96', c: 4, x: 76, y: 31, s: 16, r: -4, delay: 4.1, dashed: true },
]
const pieces = [
  { kind: 'ring', c: 4, x: 17, y: 60, s: 3.2, dur: 9 },
  { kind: 'dot', c: 0, x: 28, y: 14, s: 1.8, dur: 7 },
  { kind: 'plus', c: 2, x: 84, y: 42, s: 2.8, dur: 10 },
  { kind: 'pill', c: 1, x: 70, y: 88, s: 4.4, dur: 11, r: 30 },
  { kind: 'dot', c: 3, x: 64, y: 8, s: 1.4, dur: 8 },
  { kind: 'plus', c: 0, x: 30, y: 74, s: 2.2, dur: 9 },
]

const root = ref<HTMLElement | null>(null)
onMounted(() => {
  // SMIL can't be stopped from CSS.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches)
    root.value?.querySelectorAll<SVGSVGElement>('svg.blob').forEach(svg => svg.pauseAnimations())
})
</script>

<template>
  <div ref="root" class="backdrop" :style="{ background: base }" aria-hidden="true">
    <svg
      v-for="(b, i) in blobs"
      :key="`b${i}`"
      class="bit blob"
      viewBox="-100 -100 200 200"
      :style="{ color: colors[b.c], left: `${b.x}%`, top: `${b.y}%`, '--s': `${b.s}vmin`, '--spin': `${b.dur * 3}s` }"
    >
      <g class="spin">
        <path :d="b.frames[0]" fill="currentColor">
          <animate attributeName="d" :dur="`${b.dur}s`" repeatCount="indefinite" :values="[...b.frames, b.frames[0]].join(';')" keyTimes="0;0.25;0.5;0.75;1" calcMode="spline" :keySplines="EASE" />
        </path>
      </g>
    </svg>
    <svg
      v-for="(l, i) in lines"
      :key="`l${i}`"
      class="bit doodle"
      :class="{ dashed: l.dashed }"
      viewBox="0 0 200 120"
      :style="{ color: colors[l.c], left: `${l.x}%`, top: `${l.y}%`, '--w': `${l.s}vmin`, '--r': `${l.r}deg`, '--dd': `${l.delay}s` }"
    >
      <path :d="l.d" pathLength="1" />
    </svg>
    <span
      v-for="(p, i) in pieces"
      :key="`p${i}`"
      class="bit piece"
      :class="`piece-${p.kind}`"
      :style="{ color: colors[p.c], left: `${p.x}%`, top: `${p.y}%`, '--s': `${p.s}vmin`, '--r': `${p.r ?? 0}deg`, '--float': `${p.dur}s` }"
    ><span /></span>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  transition: background-color 300ms ease;
}
.bit {
  position: absolute;
  translate: -50% -50%;
  transform: rotate(var(--r, 0deg));
}
.blob {
  width: var(--s);
  height: var(--s);
}
.blob .spin {
  transform-box: fill-box;
  transform-origin: center;
  animation: spin var(--spin, 40s) linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.doodle {
  width: var(--w);
  height: calc(var(--w) * 0.6);
  overflow: visible;
}
.doodle path {
  fill: none;
  stroke: currentColor;
  stroke-width: 7;
  stroke-linecap: round;
  stroke-dasharray: 1 1;
  animation: draw 7.5s cubic-bezier(0.65, 0, 0.35, 1) var(--dd, 0s) infinite both;
}
@keyframes draw {
  0% { stroke-dashoffset: 1; }
  32%, 68% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -1; }
}
.doodle.dashed path {
  stroke-width: 6;
  stroke-dasharray: 0.035 0.045;
  animation: march 14s linear infinite;
}
@keyframes march { to { stroke-dashoffset: -1; } }
.piece > span {
  display: block;
  width: var(--s);
  height: var(--s);
  animation: float var(--float, 9s) cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
@keyframes float {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  33% { transform: translate(8px, -12px) rotate(25deg); }
  66% { transform: translate(-7px, 6px) rotate(-15deg); }
}
.piece-dot > span { border-radius: 50%; background: currentColor; }
.piece-ring > span { border-radius: 50%; box-shadow: inset 0 0 0 max(3px, 0.45vmin) currentColor; }
.piece-pill > span { height: calc(var(--s) * 0.42); border-radius: 9999px; background: currentColor; }
.piece-plus > span {
  background:
    linear-gradient(currentColor, currentColor) center / 100% 28% no-repeat,
    linear-gradient(currentColor, currentColor) center / 28% 100% no-repeat;
  border-radius: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .blob .spin, .doodle path, .piece > span { animation: none; }
  .doodle path { stroke-dashoffset: 0; }
}
</style>
