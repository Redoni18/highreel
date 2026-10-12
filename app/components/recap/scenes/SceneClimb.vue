<script setup lang="ts">
// climb (SPEC M2.10): a trail up a mountain. Step by step it lights from the
// foot to the peak while the number counts, then a flag goes up at the top.
// One step per unit up to 30; the zigzag is seeded, so each recap's trail
// is its own.
import type { SceneProps } from '~/lib/recap'
import { formatNumber } from '#shared/utils/slides'
import { bigSizeU, seeded, stepTimes } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const START = 500
const RUN = 2000
const value = computed(() => Math.max(0, Math.round(props.slide.value ?? 0)))

// The trail in the mountain's box (0–100 across, 0–100 down): a zigzag from the foot to the peak.
const steps = computed(() => {
  const n = Math.max(4, Math.min(30, value.value))
  const rand = seeded(`climb|${props.slide.key}|${value.value}`)
  const times = stepTimes(n, RUN, START)
  return times.map((t, i) => {
    const p = (i + 1) / n
    const y = 96 - p * 84
    // Swing left and right, narrowing towards the peak at x = 56.
    const swing = Math.sin(p * Math.PI * 3.2) * (1 - p) * 26
    const x = 56 + swing + (rand() - 0.5) * 3
    return { key: i, style: { left: `${x.toFixed(1)}%`, top: `${y.toFixed(1)}%`, '--t': `${t}ms` } }
  })
})
const chars = computed(() => formatNumber(value.value).length + (props.slide.prefix?.length ?? 0) + (props.slide.suffix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body clm" :style="{ '--hi': tone.hi, '--fg': tone.fg, '--bg': tone.bg }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <p class="big rise" style="--d: 140ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="value" :delay="START" :duration="RUN" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 220ms">{{ slide.after }}</p>

    <div class="clm-hill" aria-hidden="true">
      <svg class="clm-shape rise" style="--d: 100ms" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M-6 100 L24 46 L34 56 L56 10 L74 40 L82 32 L106 100Z" class="clm-far" />
        <path d="M6 100 L56 12 L104 100Z" class="clm-near" />
        <path d="M48 26 L56 12 L64 26 L59 23 L56 27 L52 23Z" class="clm-snow" />
      </svg>
      <span v-for="s in steps" :key="s.key" class="clm-step" :style="s.style" />
      <span class="clm-flag" :style="{ '--t': `${START + RUN + 100}ms` }"><i /></span>
    </div>
  </div>
</template>

<style scoped>
.clm { justify-content: flex-start; padding-top: calc(24 * var(--u)); }
.clm .big { margin: calc(2 * var(--u)) 0; }
.clm-hill {
  position: absolute;
  left: calc(4 * var(--u));
  right: calc(4 * var(--u));
  bottom: calc(16 * var(--u));
  height: calc(60 * var(--u));
}
.clm-shape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.clm-far { fill: color-mix(in srgb, var(--fg) 8%, transparent); }
.clm-near { fill: color-mix(in srgb, var(--fg) 15%, transparent); }
.clm-snow { fill: color-mix(in srgb, var(--fg) 45%, transparent); }
.clm-step {
  position: absolute;
  width: calc(2.6 * var(--u));
  height: calc(2.6 * var(--u));
  margin: calc(-1.3 * var(--u)) 0 0 calc(-1.3 * var(--u));
  border-radius: 50%;
  background: var(--hi);
  box-shadow: 0 0 0 calc(0.7 * var(--u)) var(--bg);
  animation: clm-pop 360ms var(--ease-pop) var(--t) both;
}
@keyframes clm-pop { from { opacity: 0; transform: scale(0); } }
.clm-flag {
  position: absolute;
  left: 56%;
  top: 12%;
  width: calc(0.9 * var(--u));
  height: calc(13 * var(--u));
  margin-top: calc(-13 * var(--u));
  background: var(--fg);
  transform-origin: 50% 100%;
  animation: clm-plant 600ms var(--ease-pop) var(--t) both;
}
.clm-flag i {
  position: absolute;
  top: 0;
  left: calc(0.9 * var(--u));
  width: calc(9 * var(--u));
  height: calc(6 * var(--u));
  background: var(--hi);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}
@keyframes clm-plant { from { opacity: 0; transform: scaleY(0); } }
</style>
