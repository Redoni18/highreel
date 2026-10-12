<script setup lang="ts">
// note (SPEC M2.5 P1): the quote mark draws itself, then the note appears
// word by word. Without a note, the "since" date rises behind a mask with a
// rule drawing under it ("With us since / March 2025 / 1 year and counting").
import type { SceneProps } from '~/lib/recap'
import { words } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const QUOTE_END = 900
const noteWords = computed(() => words(props.slide.note ?? ''))
// Spread the words over ~2 s, quicker for long notes.
const step = computed(() => Math.max(40, Math.min(110, 2000 / Math.max(1, noteWords.value.length))))
const wordDelay = (i: number) => `${QUOTE_END + Math.round(i * step.value)}ms`
const textEnd = computed(() => QUOTE_END + noteWords.value.length * step.value)

const sinceWords = computed(() => (props.slide.text ?? '').split(/\s+/).filter(Boolean))
</script>

<template>
  <div v-if="slide.note" class="s-body note">
    <svg class="quote" viewBox="0 0 124 92" aria-hidden="true" :style="{ color: tone.hi }">
      <g v-for="x in [0, 60]" :key="x" :transform="`translate(${x} 0)`">
        <path class="tail" pathLength="1" d="M48 10 C28 18 14 34 13 60" />
        <circle class="ball" pathLength="1" cx="30" cy="64" r="16" />
      </g>
    </svg>
    <p class="note-text">
      <template v-for="(w, i) in noteWords" :key="i"><span class="nw" :style="{ '--d': wordDelay(i) }">{{ w }}</span>{{ i < noteWords.length - 1 ? ' ' : '' }}</template>
    </p>
    <p v-if="slide.small" class="s-small rise" :style="{ '--d': `${textEnd + 200}ms` }">{{ slide.small }}</p>
  </div>

  <div v-else class="s-body since">
    <p v-if="slide.kicker" class="s-kicker rise" style="--d: 120ms">{{ slide.kicker }}</p>
    <p class="big-text since-date" :style="{ color: tone.hi }">
      <template v-for="(w, i) in sinceWords" :key="i"><span class="mask"><span class="wi" :style="{ '--d': `${260 + i * 110}ms` }">{{ w }}</span></span>{{ i < sinceWords.length - 1 ? ' ' : '' }}</template>
    </p>
    <span class="rule" :style="{ background: tone.hi }" aria-hidden="true" />
    <p v-if="slide.after" class="s-line rise" style="--d: 900ms">{{ slide.after }}</p>
  </div>
</template>

<style scoped>
.note, .since { justify-content: center; }
.quote {
  width: calc(26 * var(--u));
  margin-bottom: calc(5 * var(--u));
  overflow: visible;
}
.quote path,
.quote circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 9;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  animation: draw 600ms var(--ease-out) both;
}
.quote circle {
  fill: currentColor;
  animation: draw 500ms var(--ease-out) 420ms both, fill 300ms ease-out 760ms both;
}
.quote g + g path { animation-delay: 140ms; }
.quote g + g circle { animation-delay: 560ms, 860ms; }
@keyframes draw {
  from { stroke-dashoffset: 1; }
}
@keyframes fill {
  from { fill-opacity: 0; }
}
.note-text {
  font-size: calc(7 * var(--u));
  line-height: 1.22;
  font-weight: 600;
  letter-spacing: -0.02em;
  text-wrap: pretty;
}
.nw {
  display: inline-block;
  animation: word-in 460ms var(--ease-out) var(--d) both;
}
@keyframes word-in {
  from { opacity: 0; transform: translateY(0.3em); }
}
.s-small { margin-top: calc(5 * var(--u)); }
.s-kicker { margin-bottom: calc(3 * var(--u)); }
.since-date { font-size: calc(13 * var(--u)); }
.rule {
  display: block;
  width: calc(22 * var(--u));
  height: calc(1.4 * var(--u));
  margin: calc(5 * var(--u)) 0 calc(4 * var(--u));
  transform-origin: left;
  animation: rule 800ms var(--ease-out) 600ms both;
}
@keyframes rule {
  from { transform: scaleX(0); }
}
</style>
