<script setup lang="ts">
// gauge (SPEC M2.10): a dial. Its ticks light up as the needle swings to
// the number, on a scale up to the next round number (148 on a dial to 200).
// A "top X %" runs from bottom to top, so the top 5 % sits near the end.
// Works for decimals too.
import type { SceneProps } from '~/lib/recap'
import { formatNumber } from '#shared/utils/slides'
import { bigSizeU, cssEasing, easeOut, niceMax, stepTimes } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const START = 600
const RUN = 1800
const TICKS = 25
const value = computed(() => Math.max(0, props.slide.value ?? 0))
const max = computed(() => niceMax(value.value))
const share = computed(() => (props.slide.top ? (100 - Math.min(100, value.value)) / 100 : Math.min(1, value.value / max.value)))
const angle = computed(() => -90 + share.value * 180)
const lit = computed(() => Math.round(share.value * (TICKS - 1)) + 1)
const ticks = computed(() => {
  const times = stepTimes(lit.value, RUN, START)
  return Array.from({ length: TICKS }, (_, i) => ({ key: i, on: i < lit.value, style: { rotate: `${-90 + (i / (TICKS - 1)) * 180}deg`, '--t': `${times[i] ?? 0}ms` } }))
})
const ease = cssEasing(easeOut)
const ends = computed(() => (props.slide.top ? ['Bottom', 'Top'] : ['0', formatNumber(max.value)]))
const chars = computed(() => formatNumber(value.value).length + (props.slide.prefix?.length ?? 0) + (props.slide.suffix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value, 24).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body gau" :style="{ '--hi': tone.hi, '--fg': tone.fg, '--a': `${angle}deg`, '--ease-dial': ease, '--start': `${START}ms`, '--run': `${RUN}ms` }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>

    <div class="gau-dial rise" style="--d: 120ms" aria-hidden="true">
      <span v-for="t in ticks" :key="t.key" class="gau-tick" :class="{ 'gau-on': t.on }" :style="t.style"><i /></span>
      <span class="gau-needle" />
      <span class="gau-hub" />
      <span class="gau-end gau-left">{{ ends[0] }}</span>
      <span class="gau-end gau-right">{{ ends[1] }}</span>
    </div>

    <p class="big gau-value rise" style="--d: 200ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="value" :from="slide.top ? 100 : 0" :delay="START" :duration="RUN" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 260ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 1700ms">{{ slide.small }}</p>
  </div>
</template>

<style scoped>
.gau { justify-content: center; gap: calc(3 * var(--u)); }
.gau-dial {
  position: relative;
  width: calc(80 * var(--u));
  height: calc(42 * var(--u));
  margin: calc(4 * var(--u)) auto calc(2 * var(--u));
}
/* Each tick hangs from the dial's centre (bottom middle), turned to its place. */
.gau-tick {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 0;
  height: calc(38 * var(--u));
  transform-origin: 50% 100%;
}
.gau-tick i {
  position: absolute;
  top: 0;
  left: calc(-0.8 * var(--u));
  width: calc(1.6 * var(--u));
  height: calc(7 * var(--u));
  border-radius: 9999px;
  background: color-mix(in srgb, var(--fg) 22%, transparent);
}
.gau-on i {
  background: var(--hi);
  animation: gau-light 300ms ease-out var(--t) both;
}
@keyframes gau-light { from { opacity: 0.15; transform: scaleY(0.4); } }
.gau-needle {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: calc(1.8 * var(--u));
  height: calc(30 * var(--u));
  margin-left: calc(-0.9 * var(--u));
  border-radius: 9999px;
  background: var(--fg);
  transform-origin: 50% 100%;
  transform: rotate(var(--a));
  animation: gau-swing var(--run) var(--ease-dial) var(--start) both;
}
@keyframes gau-swing { from { transform: rotate(-90deg); } }
.gau-hub {
  position: absolute;
  left: 50%;
  bottom: calc(-3 * var(--u));
  width: calc(6 * var(--u));
  height: calc(6 * var(--u));
  margin-left: calc(-3 * var(--u));
  border-radius: 50%;
  background: var(--fg);
}
.gau-end {
  position: absolute;
  bottom: calc(-7 * var(--u));
  font-family: var(--font-mono);
  font-size: calc(3.2 * var(--u));
  opacity: 0.7;
}
.gau-left { left: 0; }
.gau-right { right: 0; }
.gau-value { align-self: center; margin-top: calc(6 * var(--u)); }
</style>
