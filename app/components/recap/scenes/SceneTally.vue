<script setup lang="ts">
// tally (SPEC M2.10): tally marks drawn in fives, like counting on a wall.
// Each mark is drawn when the number passes it; every fifth strikes through
// its group. Up to 50 marks; above that each one stands for a round number
// ("| = 10"). Seeded wobble, so each recap's marks are its own.
import type { SceneProps } from '~/lib/recap'
import { formatNumber } from '#shared/utils/slides'
import { bigSizeU, seeded, stepTimes, tallyPlan } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const START = 600
const RUN = 1900
const value = computed(() => Math.max(0, Math.round(props.slide.value ?? 0)))
const plan = computed(() => tallyPlan(value.value))

const groups = computed(() => {
  const rand = seeded(`tally|${props.slide.key}|${value.value}`)
  const times = stepTimes(plan.value.marks, RUN, START)
  const out: Array<{ key: number, marks: Array<{ key: number, cross: boolean, style: Record<string, string> }> }> = []
  times.forEach((t, i) => {
    const g = Math.floor(i / 5)
    const j = i % 5
    if (!out[g])
      out.push({ key: g, marks: [] })
    out[g]!.marks.push({
      key: i,
      cross: j === 4,
      style: j === 4
        ? { '--t': `${t}ms`, 'rotate': `${-34 + (rand() - 0.5) * 8}deg` }
        : { '--t': `${t}ms`, 'left': `calc(${(j * 3.4 + 0.6).toFixed(2)} * var(--u))`, 'rotate': `${((rand() - 0.5) * 9).toFixed(1)}deg`, 'height': `calc(${(13 + rand() * 2.4).toFixed(2)} * var(--u))` },
    })
  })
  return out
})

const chars = computed(() => formatNumber(value.value).length + (props.slide.prefix?.length ?? 0) + (props.slide.suffix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body tly" :style="{ '--hi': tone.hi }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <p class="big rise" style="--d: 140ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="value" :delay="START" :duration="RUN" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 220ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 1700ms">{{ slide.small }}</p>

    <div class="tly-board" aria-hidden="true">
      <span v-if="plan.unit > 1" class="tly-legend fade-in" :style="{ '--d': `${START + RUN}ms` }"><i /> = {{ formatNumber(plan.unit) }}</span>
      <div v-for="g in groups" :key="g.key" class="tly-group">
        <span v-for="m in g.marks" :key="m.key" class="tly-mark" :class="{ 'tly-cross': m.cross }" :style="m.style" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tly { justify-content: flex-start; padding-top: calc(24 * var(--u)); }
.tly .big { margin: calc(2 * var(--u)) 0; }
.tly-board {
  position: absolute;
  left: calc(8 * var(--u));
  right: calc(8 * var(--u));
  bottom: calc(20 * var(--u));
  display: flex;
  flex-wrap: wrap;
  align-content: flex-end;
  gap: calc(5 * var(--u)) calc(3.4 * var(--u));
}
.tly-group {
  position: relative;
  width: calc(13 * var(--u));
  height: calc(15 * var(--u));
}
.tly-mark {
  position: absolute;
  bottom: 0;
  width: calc(1.5 * var(--u));
  border-radius: 9999px;
  background: var(--hi);
  transform-origin: 50% 100%;
  animation: tly-draw 240ms var(--ease-out) var(--t) both;
}
.tly-cross {
  left: calc(-1.2 * var(--u));
  bottom: 46%;
  width: calc(15.6 * var(--u));
  height: calc(1.5 * var(--u));
  transform-origin: 0 50%;
  animation-name: tly-strike;
}
@keyframes tly-draw { from { transform: scaleY(0); } }
@keyframes tly-strike { from { transform: scaleX(0); } }
.tly-legend {
  position: absolute;
  right: 0;
  top: calc(-7 * var(--u));
  display: inline-flex;
  align-items: center;
  gap: calc(1.2 * var(--u));
  font-family: var(--font-mono);
  font-size: calc(3.4 * var(--u));
  opacity: 0.8;
}
.tly-legend i {
  display: inline-block;
  width: calc(0.9 * var(--u));
  height: calc(3.4 * var(--u));
  border-radius: 9999px;
  background: var(--hi);
}
</style>
