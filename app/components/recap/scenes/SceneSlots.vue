<script setup lang="ts">
// slots (SPEC M2.10): a slot machine. The lever pulls, each digit's reel
// spins in its own window and they stop one by one, left to right, while
// the lights chase around the frame. The reels are the count scene's
// odometer, set in windows and spun longer. Decimals work too.
import type { SceneProps } from '~/lib/recap'
import { formatNumber } from '#shared/utils/slides'

const props = defineProps<SceneProps>()

const value = computed(() => Math.max(0, props.slide.value ?? 0))
const chars = computed(() => formatNumber(value.value).length)
// Windows shrink to fit: up to ~9 characters across 80u.
const size = computed(() => `calc(${Math.min(22, 70 / Math.max(1, chars.value * 0.78)).toFixed(1)} * var(--u))`)
const lights = Array.from({ length: 12 }, (_, i) => i)
</script>

<template>
  <div class="s-body slt" :style="{ '--hi': tone.hi, '--fg': tone.fg, '--bg': tone.bg }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>

    <div class="slt-machine rise" style="--d: 120ms">
      <div class="slt-lights" aria-hidden="true">
        <span v-for="l in lights" :key="l" :style="{ '--i': l }" />
      </div>
      <p class="slt-reels big" :style="{ fontSize: size }">
        <span v-if="slide.prefix" class="slt-fix">{{ slide.prefix }}</span><Odometer :value="value" :delay="700" /><span v-if="slide.suffix" class="slt-fix">{{ slide.suffix }}</span>
      </p>
      <span class="slt-lever" aria-hidden="true"><i /></span>
    </div>

    <p v-if="slide.after" class="s-line rise" style="--d: 260ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 2200ms">{{ slide.small }}</p>
  </div>
</template>

<style scoped>
.slt { justify-content: center; gap: calc(4 * var(--u)); }
.slt-machine {
  position: relative;
  align-self: flex-start;
  padding: calc(7 * var(--u)) calc(4 * var(--u)) calc(5 * var(--u));
  border-radius: calc(5 * var(--u));
  background: var(--hi);
}
.slt-lights {
  position: absolute;
  top: calc(2.2 * var(--u));
  left: calc(4 * var(--u));
  right: calc(4 * var(--u));
  display: flex;
  justify-content: space-between;
}
.slt-lights span {
  width: calc(1.8 * var(--u));
  height: calc(1.8 * var(--u));
  border-radius: 50%;
  background: var(--bg);
  animation: slt-blink 900ms steps(1, end) calc(var(--i) * 75ms) infinite;
}
@keyframes slt-blink { 50% { opacity: 0.25; } }
.slt-reels {
  display: flex;
  gap: 0;
  color: var(--fg);
}
/* Each digit in its own window. No vertical padding: the reel would show its neighbours. */
.slt-reels :deep(.col),
.slt-fix {
  padding: 0 0.1em;
  margin: 0 0.13em;
  border-radius: 0.06em;
  background: var(--bg);
  color: var(--hi);
  box-shadow: 0 0 0 0.1em var(--bg);
}
.slt-reels :deep(.sep) { color: var(--bg); padding: 0 0.02em; }
.slt-reels :deep(.strip) { animation-duration: calc(var(--dur) + 900ms); animation-delay: calc(var(--delay) * 2.4); }
.slt-lever {
  position: absolute;
  top: calc(8 * var(--u));
  right: calc(-5 * var(--u));
  width: calc(1.6 * var(--u));
  height: calc(16 * var(--u));
  border-radius: 9999px;
  background: color-mix(in srgb, var(--hi) 70%, black);
  transform-origin: 50% 100%;
  animation: slt-pull 700ms var(--ease-in-out) 200ms both;
}
.slt-lever i {
  position: absolute;
  top: calc(-2.6 * var(--u));
  left: calc(-1.7 * var(--u));
  width: calc(5 * var(--u));
  height: calc(5 * var(--u));
  border-radius: 50%;
  background: var(--fg);
}
@keyframes slt-pull {
  0%, 100% { transform: none; }
  45% { transform: scaleY(0.4); }
}
</style>
