<script setup lang="ts">
// bubbles (SPEC M2.10): a bubble rises for each one as the number counts,
// then they all float gently. Up to 36 bubbles; above that each stands for a
// round number ("○ = 10"). Positions and sizes are seeded.
import type { SceneProps } from '~/lib/recap'
import { formatNumber } from '#shared/utils/slides'
import { bigSizeU, seeded, stepTimes, tokenPlan } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const START = 500
const RUN = 1900
const value = computed(() => Math.max(0, Math.round(props.slide.value ?? 0)))
const plan = computed(() => tokenPlan(value.value, 36))

const bubbles = computed(() => {
  const rand = seeded(`bubbles|${props.slide.key}|${value.value}`)
  const times = stepTimes(plan.value.count, RUN, START)
  return times.map((t, i) => {
    const size = 5 + rand() * 8
    return {
      key: i,
      style: {
        'left': `calc(${(rand() * (84 - size)).toFixed(1)} * var(--u))`,
        'bottom': `calc(${(rand() * 42).toFixed(1)} * var(--u))`,
        'width': `calc(${size.toFixed(1)} * var(--u))`,
        '--t': `${t}ms`,
        '--bob': `${(2400 + rand() * 1800).toFixed(0)}ms`,
        '--bd': `${(rand() * -2000).toFixed(0)}ms`,
      },
    }
  })
})
const chars = computed(() => formatNumber(value.value).length + (props.slide.prefix?.length ?? 0) + (props.slide.suffix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body bub" :style="{ '--hi': tone.hi }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <p class="big rise" style="--d: 140ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="value" :delay="START" :duration="RUN" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 220ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 1700ms">{{ slide.small }}</p>

    <div class="bub-tank" aria-hidden="true">
      <span v-if="plan.unit > 1" class="bub-legend fade-in" :style="{ '--d': `${START + RUN}ms` }"><i /> = {{ formatNumber(plan.unit) }}</span>
      <span v-for="b in bubbles" :key="b.key" class="bub-one" :style="b.style"><i /></span>
    </div>
  </div>
</template>

<style scoped>
.bub { justify-content: flex-start; padding-top: calc(24 * var(--u)); }
.bub .big { margin: calc(2 * var(--u)) 0; }
.bub-tank {
  position: absolute;
  left: calc(8 * var(--u));
  right: calc(8 * var(--u));
  bottom: calc(18 * var(--u));
  height: calc(56 * var(--u));
}
.bub-one {
  position: absolute;
  aspect-ratio: 1;
  animation: bub-rise 1100ms var(--ease-out) var(--t) both;
}
.bub-one i {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--hi) 22%, transparent);
  box-shadow: inset 0 0 0 calc(0.5 * var(--u)) var(--hi);
  animation: bub-bob var(--bob) var(--ease-in-out) var(--bd) infinite alternate;
}
.bub-one i::after {
  content: '';
  position: absolute;
  top: 20%;
  left: 22%;
  width: 24%;
  height: 24%;
  border-radius: 50%;
  background: color-mix(in srgb, white 70%, transparent);
}
@keyframes bub-rise { from { opacity: 0; transform: translateY(calc(60 * var(--u))) scale(0.4); } }
@keyframes bub-bob { to { transform: translateY(calc(-1.6 * var(--u))); } }
.bub-legend {
  position: absolute;
  right: 0;
  top: calc(-6 * var(--u));
  display: inline-flex;
  align-items: center;
  gap: calc(1.2 * var(--u));
  font-family: var(--font-mono);
  font-size: calc(3.4 * var(--u));
  opacity: 0.8;
}
.bub-legend i {
  display: inline-block;
  width: calc(3 * var(--u));
  height: calc(3 * var(--u));
  border-radius: 50%;
  box-shadow: inset 0 0 0 calc(0.4 * var(--u)) var(--hi);
}
</style>
