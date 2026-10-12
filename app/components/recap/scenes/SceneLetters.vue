<script setup lang="ts">
// Five ways to reveal a word or a date, letter by letter (SPEC M2.10):
// typewriter (typed on a sheet, a caret blinking), flap (a split-flap
// departure board, tiles flipping in), neon (a sign that flickers on),
// scatter (letters fly in from all over and land) and spotlight (a beam
// sweeps the dark and stops on the word). One component: the markup is the
// same row of letters, the scene name picks the look.
import type { SceneProps } from '~/lib/recap'
import { letters, seeded, wordSizeU } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const kind = computed(() => props.slide.scene as 'typewriter' | 'flap' | 'neon' | 'scatter' | 'spotlight')
const text = computed(() => `${props.slide.text ?? ''}${props.slide.suffix ?? ''}`)
// Words stay whole when the line wraps; each letter keeps its place in the whole text for its delay.
const words = computed(() => {
  const rand = seeded(`letters|${props.slide.key}|${text.value}`)
  let i = 0
  return text.value.split(/(\s+)/).filter(Boolean).map((w, wi) => ({
    key: wi,
    space: /^\s+$/.test(w),
    chars: letters(w).map(ch => ({
      key: i,
      ch,
      style: {
        '--i': i++,
        '--x': `${((rand() - 0.5) * 140).toFixed(0)}`,
        '--y': `${((rand() - 0.5) * 180).toFixed(0)}`,
        '--r': `${((rand() - 0.5) * 300).toFixed(0)}deg`,
      },
    })),
  }))
})
const count = computed(() => [...text.value].length)
const step = computed(() => (kind.value === 'typewriter' ? Math.min(90, 1500 / Math.max(1, count.value)) : Math.min(70, 1100 / Math.max(1, count.value))))
const size = computed(() => {
  const base = wordSizeU(text.value)
  // Tiles and the typewriter's mono type run wider.
  return `calc(${(kind.value === 'flap' ? Math.min(base, 9.5) : kind.value === 'typewriter' ? Math.min(base, 11) : base).toFixed(1)} * var(--u))`
})
const end = computed(() => 500 + count.value * step.value)
</script>

<template>
  <div class="s-body ltr" :class="`ltr-${kind}`" :style="{ '--hi': tone.hi, '--fg': tone.fg, '--bg': tone.bg, '--step': `${step}ms` }">
    <span v-if="kind === 'spotlight'" class="ltr-dark" aria-hidden="true" />
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>

    <div class="ltr-stage" :style="{ fontSize: size }">
      <p class="ltr-word">
        <!-- Read as one word; the letters below are only how it looks. -->
        <span class="sr-only">{{ text }}</span>
        <template v-for="w in words" :key="w.key">
          <span v-if="w.space" class="ltr-space" aria-hidden="true"> </span>
          <span v-else class="ltr-group" aria-hidden="true"><span v-for="c in w.chars" :key="c.key" class="ltr-ch" :style="c.style">{{ c.ch }}</span></span>
        </template>
        <span v-if="kind === 'typewriter'" class="ltr-caret" aria-hidden="true" :style="{ '--end': `${end}ms` }" />
      </p>
    </div>

    <p v-if="slide.after" class="s-line rise" :style="{ '--d': `${end + 200}ms` }">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" :style="{ '--d': `${end + 400}ms` }">{{ slide.small }}</p>
  </div>
</template>

<style scoped>
.ltr { justify-content: center; gap: calc(4 * var(--u)); }
.ltr-stage { position: relative; margin: calc(3 * var(--u)) 0; }
.ltr-word {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  row-gap: 0.18em;
  font-weight: 750;
  line-height: 1;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}
.ltr-group { display: inline-flex; white-space: nowrap; }
.ltr-space { display: inline-block; width: 0.32em; }
.ltr-ch { display: inline-block; }

/* Typewriter: mono type on a sheet, each letter struck in turn. */
.ltr-typewriter .ltr-stage {
  padding: calc(6 * var(--u)) calc(6 * var(--u)) calc(7 * var(--u));
  border-radius: calc(1.6 * var(--u));
  background: #FBF8F1;
  color: #1C1C1C;
  rotate: -1.5deg;
  box-shadow: 0 calc(2 * var(--u)) calc(6 * var(--u)) rgb(0 0 0 / 0.18);
  animation: rcp-rise 700ms var(--ease-out) 100ms both;
}
.ltr-typewriter .ltr-word { font-family: var(--font-mono); font-weight: 600; letter-spacing: -0.02em; }
.ltr-typewriter .ltr-ch { animation: ltr-type 1ms steps(1, end) calc(500ms + var(--i) * var(--step)) both; }
@keyframes ltr-type { from { opacity: 0; } }
.ltr-caret {
  display: inline-block;
  width: 0.08em;
  height: 0.9em;
  margin-left: 0.06em;
  background: var(--hi);
  animation: ltr-blink 900ms steps(1, end) var(--end) infinite;
}
@keyframes ltr-blink { 50% { opacity: 0; } }

/* Departure board: dark tiles, each flipping down into place. */
.ltr-flap .ltr-word { gap: 0.08em; row-gap: 0.14em; font-family: var(--font-mono); font-weight: 700; text-transform: uppercase; letter-spacing: 0; }
.ltr-flap .ltr-group { gap: 0.08em; }
.ltr-flap .ltr-space { width: 0.5em; }
.ltr-flap .ltr-ch {
  position: relative;
  min-width: 0.78em;
  padding: 0.12em 0.04em;
  border-radius: 0.1em;
  background: color-mix(in srgb, var(--fg) 88%, black);
  color: var(--bg);
  text-align: center;
  transform-origin: 50% 0;
  animation: ltr-flip 520ms var(--ease-out) calc(400ms + var(--i) * var(--step)) both;
}
.ltr-flap .ltr-ch::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 0.03em;
  background: rgb(0 0 0 / 0.45);
}
@keyframes ltr-flip {
  0% { opacity: 0; transform: perspective(4em) rotateX(-90deg); }
  60% { opacity: 1; transform: perspective(4em) rotateX(18deg); }
}

/* Neon: a glowing tube that stutters on. */
.ltr-neon .ltr-stage {
  padding: calc(5 * var(--u)) calc(6 * var(--u));
  border-radius: calc(5 * var(--u));
  box-shadow: 0 0 0 calc(0.6 * var(--u)) var(--hi), 0 0 calc(4 * var(--u)) color-mix(in srgb, var(--hi) 70%, transparent), inset 0 0 calc(4 * var(--u)) color-mix(in srgb, var(--hi) 40%, transparent);
  animation: ltr-flicker 1400ms linear 300ms both;
}
.ltr-neon .ltr-word {
  color: var(--hi);
  font-weight: 600;
  letter-spacing: 0;
  text-shadow: 0 0 0.08em var(--hi), 0 0 0.3em color-mix(in srgb, var(--hi) 70%, transparent);
}
.ltr-neon .ltr-ch { animation: ltr-flicker 1600ms linear calc(500ms + var(--i) * 40ms) both; }
@keyframes ltr-flicker {
  0% { opacity: 0; }
  8% { opacity: 1; }
  12% { opacity: 0.1; }
  20% { opacity: 1; }
  24% { opacity: 0.25; }
  34% { opacity: 1; }
  60% { opacity: 0.8; }
  64% { opacity: 1; }
}

/* Letters fly in, spinning, from scattered places. */
.ltr-scatter .ltr-word { color: var(--hi); }
.ltr-scatter .ltr-ch { animation: ltr-fly 900ms var(--ease-pop) calc(250ms + var(--i) * 45ms) both; }
@keyframes ltr-fly {
  from { opacity: 0; transform: translate(calc(var(--x) * var(--u)), calc(var(--y) * var(--u))) rotate(var(--r)) scale(0.4); }
}

/* Spotlight: dark all round, a beam sweeps across and stops on the word,
   then the lights come up (the end state: no dark at all). */
.ltr-spotlight { overflow: hidden; }
.ltr-dark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 300%;
  height: 300%;
  margin: -150% 0 0 -150%;
  background: radial-gradient(circle at center, transparent 0, transparent calc(26 * var(--u)), rgb(0 0 0 / 0.82) calc(36 * var(--u)));
  z-index: 2;
  pointer-events: none;
  opacity: 0;
  animation: ltr-sweep 3000ms var(--ease-in-out) 200ms both;
}
@keyframes ltr-sweep {
  0% { opacity: 1; transform: translate(-28%, -10%); }
  30% { opacity: 1; transform: translate(22%, 6%); }
  55% { opacity: 1; transform: translate(-6%, 2%); }
  72% { opacity: 1; transform: none; }
  100% { opacity: 0; transform: none; }
}
.ltr-spotlight .ltr-word { color: var(--hi); }
</style>
