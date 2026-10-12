<script setup lang="ts">
// rank (SPEC M2.5 P1): 100 dots, one per percent of customers. All light up,
// then the number counts down from 100 to the viewer's "top X%" while the
// dots beyond X dim, until only the top X stay lit. The last of them is the
// viewer: it pulses, "You're here".
import type { SceneProps } from '~/lib/recap'
import { bigSizeU, stepTimes } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const START = 900
const FILL = 1800

const top = computed(() => Math.min(100, Math.max(1, Math.round(props.slide.value ?? 100))))
const dims = computed(() => stepTimes(100 - top.value, FILL, START))
const dots = computed(() => Array.from({ length: 100 }, (_, i) => {
  const row = Math.floor(i / 10)
  const col = i % 10
  const style: Record<string, string> = { '--in': `${120 + (row + col) * 22}ms` }
  if (i >= top.value)
    style['--t'] = `${dims.value[99 - i]}ms`
  return { i, kept: i < top.value, you: i === top.value - 1, style }
}))
const you = computed(() => ({ row: Math.floor((top.value - 1) / 10), col: (top.value - 1) % 10 }))
const end = START + FILL

const chars = computed(() => String(top.value).length + (props.slide.suffix?.length ?? 0) + (props.slide.prefix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value, 28).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body rank" :style="{ '--hi': tone.hi }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <p class="big rise" style="--d: 160ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="top" :from="100" :delay="START" :duration="FILL" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 240ms">{{ slide.after }}</p>

    <div class="grid" aria-hidden="true">
      <span v-for="d in dots" :key="d.i" class="dot" :class="{ kept: d.kept, you: d.you }" :style="d.style" />
      <span
        class="you-label"
        :class="{ flip: you.col > 6 }"
        :style="{ '--row': you.row, '--col': you.col, '--d': `${end + 150}ms`, background: tone.hi, color: tone.bg }"
      >You're here</span>
    </div>
  </div>
</template>

<style scoped>
.rank { justify-content: center; }
.big { margin: calc(1.5 * var(--u)) 0 calc(2 * var(--u)); }
.grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: calc(2.8 * var(--u));
  width: calc(76 * var(--u));
  margin-top: calc(8 * var(--u));
}
.dot {
  position: relative;
  aspect-ratio: 1;
  border-radius: 50%;
  background: color-mix(in srgb, currentColor 16%, transparent);
  animation: dot-in 500ms var(--ease-pop) var(--in) both;
}
@keyframes dot-in {
  from { opacity: 0; transform: scale(0); }
}
/* Every dot starts lit; the ones past the viewer's rank dim one by one. */
.dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--hi);
  opacity: 0;
  animation: dim 360ms ease-out var(--t) both;
}
.dot.kept::after {
  opacity: 1;
  animation: none;
}
@keyframes dim {
  from { opacity: 1; }
}
.you::before {
  content: '';
  position: absolute;
  inset: calc(-1.6 * var(--u));
  border-radius: 50%;
  border: max(1.5px, calc(0.6 * var(--u))) solid var(--hi);
  /* after the count-down ends (START + FILL) */
  animation: ring 1500ms ease-out 2850ms 3 backwards;
}
@keyframes ring {
  from { opacity: 0.9; transform: scale(0.6); }
  to { opacity: 0; transform: scale(1.9); }
}
.you-label {
  position: absolute;
  /* centred above the viewer's dot: each cell is (76u − 9 gaps) / 10 wide */
  left: calc((var(--col) + 0.5) * (76 * var(--u) + 2.8 * var(--u)) / 10);
  top: calc(var(--row) * (76 * var(--u) + 2.8 * var(--u)) / 10 - 7.5 * var(--u));
  translate: -20% 0;
  padding: calc(0.9 * var(--u)) calc(2.2 * var(--u));
  border-radius: 9999px;
  font-size: calc(3.2 * var(--u));
  font-weight: 700;
  white-space: nowrap;
  animation: label-in 600ms var(--ease-pop) var(--d) both;
}
.you-label.flip { translate: -80% 0; }
@keyframes label-in {
  from { opacity: 0; transform: translateY(calc(2 * var(--u))) scale(0.6); }
}
</style>
