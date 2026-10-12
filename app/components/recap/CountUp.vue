<script setup lang="ts">
// A number that counts from `from` to `value` when its slide enters (SPEC
// §5.2), on the same ease-out curve the scenes use for their visuals, so the
// calendar, chain or dots move with it. Freezes while the viewer holds the
// story. Reduced motion shows the final value straight away.
import { RECAP_CLOCK } from '~/lib/recap'
import { easeOut } from '#shared/utils/scenes'
import { formatNumber } from '#shared/utils/slides'

const props = withDefaults(defineProps<{ value: number, from?: number, delay?: number, duration?: number, reduced?: boolean }>(), {
  from: 0,
  delay: 0,
  duration: 1100,
  reduced: false,
})

const clock = inject(RECAP_CLOCK, null)
const scale = computed(() => (Number.isInteger(props.value) ? 1 : 100))
const shown = ref(props.reduced ? props.value : props.from)
let raf = 0

function run() {
  cancelAnimationFrame(raf)
  if (props.reduced) {
    shown.value = props.value
    return
  }
  shown.value = props.from
  let elapsed = 0
  let last = performance.now()
  const step = (now: number) => {
    if (!clock?.held.value)
      elapsed += now - last
    last = now
    const t = Math.max(0, elapsed - props.delay) / props.duration
    // Decimals count in their own steps (24.5 passes 12.3, not 12).
    shown.value = Math.round((props.from + (props.value - props.from) * easeOut(t)) * scale.value) / scale.value
    if (t < 1)
      raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

onMounted(run)
watch(() => [props.value, props.reduced], run)
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <span class="tabular-nums" :aria-label="formatNumber(value)">{{ formatNumber(shown) }}</span>
</template>
