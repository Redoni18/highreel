<script setup lang="ts">
// streak (SPEC M2.5 P1): a chain of N links (rings joined by bars) lights up
// in sequence as the number counts; long chains pan so the newest link stays
// in view, and the last one glows. One link per day/week up to 120.
import type { SceneProps } from '~/lib/recap'
import { formatNumber } from '#shared/utils/slides'
import { bigSizeU, chainLinks, cssEasing, easeOut, stepTimes } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const START = 450
const FILL = 2300
/** Distance between links, and how far right the newest link may get before the chain pans (in u). */
const PITCH = 8
const VIEW = 74

const value = computed(() => Math.max(0, props.slide.value ?? 0))
const links = computed(() => chainLinks(value.value))
const times = computed(() => stepTimes(links.value, FILL, START))
const width = computed(() => (links.value - 1) * PITCH + 12)
// Short chains sit centred; long ones start at the left edge and pan.
const pans = computed(() => width.value > 84)
const panEnd = computed(() => Math.max(0, width.value - VIEW - 6))
const panEasing = computed(() => {
  const n = links.value
  const end = panEnd.value
  // Offset when the counter has lit `lit` links: keep the head at VIEW.
  return cssEasing((t) => {
    const head = easeOut(t) * n * PITCH
    return end ? Math.min(1, Math.max(0, head - VIEW) / end) : 0
  }, 32)
})

const chars = computed(() => formatNumber(value.value).length + (props.slide.suffix?.length ?? 0) + (props.slide.prefix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body streak" :style="{ '--hi': tone.hi }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>

    <div class="band" aria-hidden="true">
      <div
        class="chain"
        :class="{ pans }"
        :style="{
          width: `calc(${width} * var(--u))`,
          '--pan-end': `calc(${-panEnd} * var(--u))`,
          '--pan-ease': panEasing,
          '--pan-start': `${START}ms`,
          '--pan-dur': `${FILL}ms`,
        }"
      >
        <span
          v-for="(t, i) in times"
          :key="i"
          class="link"
          :class="[i % 2 ? 'bar' : 'loop', { last: i === links - 1 }]"
          :style="{ left: `calc(${i * PITCH} * var(--u))`, '--t': `${t}ms` }"
        />
      </div>
    </div>

    <p class="big rise" style="--d: 200ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="value" :delay="START" :duration="FILL" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 280ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" :style="{ '--d': `${START + FILL - 300}ms` }">{{ slide.small }}</p>
  </div>
</template>

<style scoped>
.streak { justify-content: center; }
.band {
  position: relative;
  height: calc(16 * var(--u));
  margin: calc(9 * var(--u)) calc(-8 * var(--u)) calc(8 * var(--u));
  overflow: hidden;
}
.chain {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  translate: -50% 0;
}
.chain.pans {
  left: calc(8 * var(--u));
  translate: none;
  transform: translateX(var(--pan-end));
  animation: pan var(--pan-dur) var(--pan-ease) var(--pan-start) both;
}
@keyframes pan {
  from { transform: none; }
}
.link {
  position: absolute;
  top: 50%;
}
.link::before,
.link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
}
.loop {
  width: calc(12 * var(--u));
  height: calc(8.4 * var(--u));
  margin-top: calc(-4.2 * var(--u));
}
.loop::before,
.loop::after {
  border: calc(1.7 * var(--u)) solid color-mix(in srgb, currentColor 22%, transparent);
}
.loop::after { border-color: var(--hi); }
.bar {
  width: calc(9 * var(--u));
  height: calc(2.8 * var(--u));
  margin-top: calc(-1.4 * var(--u));
  margin-left: calc(1.5 * var(--u));
  z-index: 1;
}
.bar::before { background: color-mix(in srgb, currentColor 22%, transparent); }
.bar::after { background: var(--hi); }
.link::after {
  animation: light 420ms var(--ease-pop) both;
  animation-delay: var(--t);
}
@keyframes light {
  from { opacity: 0; transform: scale(0.6); }
}
/* The newest link glows once the chain is done. */
.last {
  z-index: 2;
}
.last::before {
  inset: calc(-5 * var(--u));
  border: 0;
  background: radial-gradient(closest-side, var(--hi), transparent);
  opacity: 0.55;
  animation: glow 1600ms ease-in-out calc(var(--t) + 300ms) infinite alternate backwards;
}
@keyframes glow {
  from { opacity: 0; transform: scale(0.6); }
  to { opacity: 0.7; transform: scale(1.15); }
}
.big { margin-top: calc(1 * var(--u)); }
.s-small { margin-top: calc(4 * var(--u)); }
</style>
