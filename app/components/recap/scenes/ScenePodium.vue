<script setup lang="ts">
// podium (SPEC M2.10, a "top X %" slide): three blocks rise; theirs is the
// tallest, in the middle, with "Top 5 %" on it and a crown dropping on top,
// while the number counts down from 100. Confetti bits are seeded.
import type { SceneProps } from '~/lib/recap'
import { readableOn } from '#shared/utils/color'
import { bigSizeU, seeded } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const top = computed(() => Math.min(100, Math.max(1, Math.round(props.slide.value ?? 100))))
const ink = computed(() => readableOn(props.tone.hi))
const blocks = [
  { key: 'second', h: 26, d: 500, place: '2' },
  { key: 'first', h: 40, d: 300, place: '' },
  { key: 'third', h: 17, d: 700, place: '3' },
]
const bits = computed(() => {
  const rand = seeded(`podium|${props.slide.key}|${top.value}`)
  return Array.from({ length: 14 }, (_, i) => ({
    key: i,
    style: {
      'left': `${(30 + rand() * 40).toFixed(1)}%`,
      'top': `${(rand() * 30).toFixed(1)}%`,
      '--x': `${((rand() - 0.5) * 60).toFixed(0)}`,
      '--y': `${(40 + rand() * 30).toFixed(0)}`,
      'rotate': `${(rand() * 180).toFixed(0)}deg`,
      '--d': `${1500 + Math.round(rand() * 300)}ms`,
    },
  }))
})
const chars = computed(() => String(top.value).length + (props.slide.prefix?.length ?? 0) + (props.slide.suffix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value, 24).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body pod" :style="{ '--hi': tone.hi, '--fg': tone.fg, '--bg': tone.bg }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <p class="big rise" style="--d: 140ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="top" :from="100" :delay="600" :duration="1500" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 220ms">{{ slide.after }}</p>

    <div class="pod-stage" aria-hidden="true">
      <span v-for="b in bits" :key="b.key" class="pod-bit" :style="b.style" />
      <div v-for="b in blocks" :key="b.key" class="pod-col" :class="`pod-${b.key}`">
        <span v-if="b.key === 'first'" class="pod-crown" />
        <div class="pod-block" :style="{ height: `calc(${b.h} * var(--u))`, '--d': `${b.d}ms` }">
          <span v-if="b.place" class="pod-place">{{ b.place }}</span>
          <span v-else class="pod-you" :style="{ color: ink }">You<b>Top {{ top }}%</b></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pod { justify-content: flex-start; padding-top: calc(24 * var(--u)); }
.pod .big { margin: calc(2 * var(--u)) 0; }
.pod-stage {
  position: absolute;
  left: calc(8 * var(--u));
  right: calc(8 * var(--u));
  bottom: calc(17 * var(--u));
  height: calc(56 * var(--u));
  display: flex;
  align-items: flex-end;
  gap: calc(1.6 * var(--u));
}
.pod-col {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
}
.pod-block {
  position: relative;
  display: flex;
  align-self: stretch;
  align-items: flex-start;
  justify-content: center;
  padding-top: calc(3 * var(--u));
  border-radius: calc(2 * var(--u)) calc(2 * var(--u)) 0 0;
  background: color-mix(in srgb, var(--fg) 16%, transparent);
  transform-origin: 50% 100%;
  animation: pod-rise 760ms var(--ease-soft) var(--d) both;
}
.pod-first .pod-block { background: var(--hi); }
@keyframes pod-rise { from { transform: scaleY(0); } }
.pod-place {
  font-size: calc(7 * var(--u));
  font-weight: 800;
  opacity: 0.6;
}
.pod-you {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: calc(4 * var(--u));
  font-weight: 600;
  animation: rcp-fade 400ms ease-out 1000ms both;
}
.pod-you b { font-size: calc(5.6 * var(--u)); font-weight: 800; }
.pod-crown {
  width: calc(12 * var(--u));
  height: calc(8 * var(--u));
  margin-bottom: calc(1.4 * var(--u));
  background: var(--hi);
  clip-path: polygon(0 100%, 0 20%, 25% 55%, 50% 0, 75% 55%, 100% 20%, 100% 100%);
  animation: pod-crown 600ms var(--ease-drop) 1250ms both;
}
@keyframes pod-crown { from { opacity: 0; transform: translateY(calc(-24 * var(--u))) rotate(-20deg); } }
.pod-bit {
  position: absolute;
  width: calc(1.6 * var(--u));
  height: calc(3 * var(--u));
  border-radius: 9999px;
  background: var(--hi);
  opacity: 0;
  animation: pod-burst 1400ms var(--ease-out) var(--d) both;
}
.pod-bit:nth-child(3n) { background: var(--fg); }
@keyframes pod-burst {
  0% { opacity: 1; transform: translate(0, calc(20 * var(--u))) scale(0.4); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translate(calc(var(--x) * 0.5 * var(--u)), calc(var(--y) * -0.3 * var(--u))); }
}
</style>
