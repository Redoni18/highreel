<script setup lang="ts">
// bignumber (SPEC M2.10): poster-size type. The number fills the width while
// outlined echoes of it slide in from alternating sides behind, then it
// settles with a little pop. A "top X %" counts down from 100. Works for
// whole numbers, decimals and ranks.
import type { SceneProps } from '~/lib/recap'
import { formatNumber } from '#shared/utils/slides'

const props = defineProps<SceneProps>()

const value = computed(() => Math.max(0, props.slide.value ?? 0))
const text = computed(() => `${props.slide.prefix ?? ''}${formatNumber(value.value)}${props.slide.suffix ?? ''}`)
// As big as fits: 84u across, a digit is ~0.6em.
const size = computed(() => `calc(${Math.min(48, 84 / Math.max(1, text.value.length * 0.6)).toFixed(1)} * var(--u))`)
// One outlined copy above and one below, in the stack's own margin, so they never cover the lines.
const echoes = [
  { key: 0, y: -0.9, from: '-120%', d: 140 },
  { key: 1, y: 0.9, from: '120%', d: 280 },
]
</script>

<template>
  <div class="s-body bnum" :style="{ '--hi': tone.hi, '--fg': tone.fg }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <div class="bnum-stack" :style="{ fontSize: size }">
      <span v-for="e in echoes" :key="e.key" class="bnum-echo" aria-hidden="true" :style="{ '--y': e.y, '--from': e.from, '--d': `${e.d}ms` }">{{ text }}</span>
      <p class="bnum-main">
        <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="value" :from="slide.top ? 100 : 0" :delay="500" :duration="1500" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
      </p>
    </div>
    <p v-if="slide.after" class="s-line rise" style="--d: 900ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 1100ms">{{ slide.small }}</p>
  </div>
</template>

<style scoped>
.bnum { justify-content: center; gap: calc(3 * var(--u)); }
.bnum-stack {
  position: relative;
  margin: 0.95em 0;
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: -0.06em;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.paper .bnum-stack { font-family: var(--font-mono); letter-spacing: -0.07em; }
.bnum-main {
  position: relative;
  color: var(--hi);
  animation: bnum-pop 700ms var(--ease-pop) 420ms both;
}
@keyframes bnum-pop { from { opacity: 0; transform: scale(1.35); } }
.bnum-echo {
  position: absolute;
  left: 0;
  top: 0;
  color: transparent;
  -webkit-text-stroke: max(1px, 0.012em) color-mix(in srgb, var(--fg) 28%, transparent);
  transform: translateY(calc(var(--y) * 1em));
  animation: bnum-echo 800ms var(--ease-out) var(--d) both;
}
@keyframes bnum-echo { from { opacity: 0; transform: translate(var(--from), calc(var(--y) * 1em)); } }
</style>
