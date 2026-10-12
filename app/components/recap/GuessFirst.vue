<script setup lang="ts">
// "Guess first" (SPEC M2.5 P1): before a number is revealed, the viewer picks
// from three: the real one and two decoys. The pick shows right or wrong for
// a moment, then the scene plays. The story waits; tapping elsewhere on the
// right reveals without guessing.
import type { Tone } from '#shared/utils/color'
import type { Slide } from '#shared/utils/slides'
import { formatNumber } from '#shared/utils/slides'

const props = defineProps<{ slide: Slide, tone: Tone, paper: boolean, reduced: boolean }>()
const emit = defineEmits<{ answer: [value: number] }>()

const picked = ref<number | null>(null)
// Built here: Vue drops the spaces around an inline element in the template.
const lead = computed(() => (props.slide.before ? `${props.slide.before} ` : ''))
const tail = computed(() => (props.slide.after ? ` ${props.slide.after}` : ''))
const label = (v: number) => `${props.slide.prefix ?? ''}${formatNumber(v)}${props.slide.suffix ?? ''}`
let timer: ReturnType<typeof setTimeout> | undefined

function pick(v: number) {
  if (picked.value != null)
    return
  picked.value = v
  timer = setTimeout(() => emit('answer', v), props.reduced ? 350 : 1000)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="s-body guess" :class="{ done: picked != null }">
    <p class="s-kicker rise">Take a guess</p>
    <p class="s-line question rise" style="--d: 80ms">
      {{ lead }}<span class="blank" :style="{ color: tone.hi }">{{ slide.prefix }}?{{ slide.suffix }}</span>{{ tail }}
    </p>
    <div class="choices" role="group" aria-label="Your guess">
      <button
        v-for="(v, i) in slide.guess"
        :key="v"
        type="button"
        class="choice rise"
        :class="{ right: picked != null && v === slide.value, wrong: picked === v && v !== slide.value }"
        :style="{ '--d': `${200 + i * 90}ms`, '--hi': tone.hi, '--on-hi': tone.bg }"
        :disabled="picked != null"
        :aria-pressed="picked === v"
        @click="pick(v)"
      >
        {{ label(v) }}
      </button>
    </div>
    <p class="s-small rise" style="--d: 520ms" aria-live="polite">
      <template v-if="picked == null">Tap a number to see your real one.</template>
      <template v-else-if="picked === slide.value">Spot on.</template>
      <template v-else>It was {{ label(slide.value!) }}.</template>
    </p>
  </div>
</template>

<style scoped>
.guess {
  justify-content: center;
  gap: calc(3 * var(--u));
}
.question { margin-bottom: calc(4 * var(--u)); }
.blank {
  display: inline-block;
  font-weight: 800;
  animation: wobble 1800ms ease-in-out 900ms infinite;
}
@keyframes wobble {
  0%, 60%, 100% { transform: none; }
  70% { transform: rotate(-10deg) scale(1.1); }
  85% { transform: rotate(8deg) scale(1.1); }
}
.choices {
  display: flex;
  flex-direction: column;
  gap: calc(2.6 * var(--u));
}
.choice {
  height: calc(14 * var(--u));
  border-radius: 9999px;
  border: max(1.5px, calc(0.5 * var(--u))) solid color-mix(in srgb, currentColor 45%, transparent);
  font-size: calc(6.4 * var(--u));
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: inherit;
  transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease, opacity 200ms ease;
}
.paper .choice { font-family: var(--font-mono); font-weight: 600; }
.choice:not(:disabled):active { transform: scale(0.98); }
.choice:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.choice:disabled { cursor: default; }
.done .choice:not(.right):not(.wrong) { opacity: 0.4; }
.choice.right {
  background: var(--hi);
  border-color: var(--hi);
  color: var(--on-hi);
  animation: right 500ms var(--ease-pop) both;
}
.choice.wrong {
  text-decoration: line-through;
  opacity: 0.55;
  animation: shake 420ms ease-in-out both;
}
@keyframes right {
  from { transform: scale(0.94); }
}
@keyframes shake {
  20% { transform: translateX(calc(-2 * var(--u))); }
  40% { transform: translateX(calc(2 * var(--u))); }
  60% { transform: translateX(calc(-1.2 * var(--u))); }
  80% { transform: translateX(calc(1.2 * var(--u))); }
}
.s-small { margin-top: calc(2 * var(--u)); }
</style>
