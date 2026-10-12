<script setup lang="ts">
// fill (SPEC M2.10): a glass fills up while the number counts, a wave
// rolling on top and bubbles rising through it. The level is the same for
// everyone (a glass is "full" at any number); the number says how much.
// Works for decimals too.
import type { SceneProps } from '~/lib/recap'
import { formatNumber } from '#shared/utils/slides'
import { bigSizeU, cssEasing, easeOut, seeded } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const START = 500
const RUN = 2000
const value = computed(() => Math.max(0, props.slide.value ?? 0))
const ease = cssEasing(easeOut)
const bubbles = computed(() => {
  const rand = seeded(`fill|${props.slide.key}|${value.value}`)
  return Array.from({ length: 9 }, (_, i) => ({
    key: i,
    style: {
      'left': `${(8 + rand() * 80).toFixed(1)}%`,
      'width': `calc(${(1.4 + rand() * 2).toFixed(2)} * var(--u))`,
      '--rise': `${(2600 + rand() * 2200).toFixed(0)}ms`,
      '--d': `${(START + rand() * 2400).toFixed(0)}ms`,
    },
  }))
})
const chars = computed(() => formatNumber(value.value).length + (props.slide.prefix?.length ?? 0) + (props.slide.suffix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value, 26).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body fil" :style="{ '--hi': tone.hi, '--fg': tone.fg, '--bg': tone.bg, '--ease-fill': ease }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <p class="big rise" style="--d: 140ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="value" :delay="START" :duration="RUN" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 220ms">{{ slide.after }}</p>

    <div class="fil-glass rise" style="--d: 200ms" aria-hidden="true">
      <div class="fil-liquid" :style="{ '--start': `${START}ms`, '--run': `${RUN}ms` }">
        <svg class="fil-wave" viewBox="0 0 200 20" preserveAspectRatio="none"><path d="M0 10 Q25 0 50 10 T100 10 T150 10 T200 10 V20 H0Z" /></svg>
        <span v-for="b in bubbles" :key="b.key" class="fil-bubble" :style="b.style" />
      </div>
      <span class="fil-shine" />
    </div>
  </div>
</template>

<style scoped>
.fil { justify-content: flex-start; padding-top: calc(22 * var(--u)); }
.fil .big { margin: calc(2 * var(--u)) 0; }
.fil-glass {
  position: absolute;
  left: 50%;
  bottom: calc(17 * var(--u));
  width: calc(44 * var(--u));
  height: calc(56 * var(--u));
  margin-left: calc(-22 * var(--u));
  overflow: hidden;
  border-radius: calc(3 * var(--u)) calc(3 * var(--u)) calc(14 * var(--u)) calc(14 * var(--u));
  box-shadow: inset 0 0 0 calc(1.2 * var(--u)) color-mix(in srgb, var(--fg) 70%, transparent);
  background: color-mix(in srgb, var(--fg) 6%, transparent);
}
.fil-liquid {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 80%;
  background: var(--hi);
  animation: fil-up var(--run) var(--ease-fill) var(--start) both;
}
@keyframes fil-up { from { transform: translateY(100%); } }
.fil-wave {
  position: absolute;
  left: 0;
  bottom: calc(100% - 1px);
  width: 200%;
  height: calc(4 * var(--u));
  fill: var(--hi);
  animation: fil-roll 2.6s linear infinite;
}
@keyframes fil-roll { to { transform: translateX(-50%); } }
.fil-bubble {
  position: absolute;
  bottom: calc(2 * var(--u));
  aspect-ratio: 1;
  border-radius: 50%;
  background: color-mix(in srgb, var(--bg) 45%, transparent);
  opacity: 0;
  animation: fil-bubble var(--rise) ease-in var(--d) infinite;
}
@keyframes fil-bubble {
  0% { opacity: 0; transform: translateY(0); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translateY(calc(-40 * var(--u))); }
}
.fil-shine {
  position: absolute;
  top: calc(5 * var(--u));
  left: calc(5 * var(--u));
  width: calc(2.4 * var(--u));
  height: 46%;
  border-radius: 9999px;
  background: color-mix(in srgb, white 45%, transparent);
}
</style>
