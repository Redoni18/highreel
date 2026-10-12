<script setup lang="ts">
// Rolling digits (SPEC M2.5 P1, count scene): each digit spins down a strip
// of 0–9 and lands with a little spring, left to right. Separators stay put.
// The strips rest on the final digits, so reduced motion shows the number.
import { formatNumber } from '#shared/utils/slides'

const props = withDefaults(defineProps<{ value: number, delay?: number }>(), { delay: 0 })

const columns = computed(() => {
  const text = formatNumber(props.value)
  const digitsTotal = text.replace(/\D/g, '').length
  let seen = 0
  return [...text].map((ch, i) => {
    if (!/\d/.test(ch))
      return { key: i, sep: ch }
    const fromRight = digitsTotal - 1 - seen
    const order = seen++
    // Lower digits spin more, like a real counter; everything lands within ~1.6 s.
    const turns = Math.min(3, fromRight + 1)
    const steps = turns * 10 + Number(ch)
    return { key: i, digit: Number(ch), steps, delay: props.delay + order * 90, duration: 1100 + fromRight * 120 }
  })
})
</script>

<template>
  <span class="odometer" :aria-label="formatNumber(value)">
    <template v-for="c in columns" :key="c.key">
      <span v-if="c.sep !== undefined" class="sep" aria-hidden="true">{{ c.sep }}</span>
      <span v-else class="col" aria-hidden="true">
        <span class="strip" :style="{ '--steps': c.steps, '--delay': `${c.delay}ms`, '--dur': `${c.duration}ms` }">
          <span v-for="n in c.steps + 1" :key="n">{{ (n - 1) % 10 }}</span>
        </span>
      </span>
    </template>
  </span>
</template>

<style scoped>
.odometer {
  display: inline-flex;
  font-variant-numeric: tabular-nums;
}
.col {
  display: inline-block;
  height: 1em;
  overflow: hidden;
  /* room for the spring's overshoot without showing the next digit */
  padding: 0.04em 0;
  margin: -0.04em 0;
  box-sizing: content-box;
}
.strip {
  display: flex;
  flex-direction: column;
  transform: translateY(calc(var(--steps) * -1em));
  /* no overshoot: on a long strip even 2 % would show the next digit */
  animation: roll var(--dur) cubic-bezier(0.12, 0.9, 0.2, 1) var(--delay) both;
}
.strip > span {
  height: 1em;
  line-height: 1;
}
@keyframes roll {
  from { transform: translateY(0); }
}
</style>
