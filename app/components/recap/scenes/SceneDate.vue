<script setup lang="ts">
// date (SPEC M2.7): a tear-off calendar page for a day ("Your first gift:
// February 14, 2026"). The two days before it tear off and fall away, the
// date's page is left, and a hand-drawn circle lands on the day. Base styles
// are the end state, so reduced motion shows the page straight away.
import type { SceneProps } from '~/lib/recap'

const props = defineProps<SceneProps>()

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function page(offset: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.slide.date ?? '')
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + offset)) : null
  return d
    ? { month: MONTHS[d.getUTCMonth()]!, day: String(d.getUTCDate()), weekday: WEEKDAYS[d.getUTCDay()]!, year: String(d.getUTCFullYear()) }
    : { month: '', day: '', weekday: '', year: '' }
}
const main = computed(() => page(0))
// Torn off first to last: two days before, then the day before.
const torn = computed(() => [page(-2), page(-1)].map((p, i) => ({ ...p, style: { '--t': `${450 + i * 620}ms`, '--r': i ? '9deg' : '-11deg' } })))
</script>

<template>
  <div class="s-body date-scene" :style="{ '--hi': tone.hi }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>

    <div class="pad rise" style="--d: 140ms" aria-hidden="true">
      <div class="sheet back" />
      <div class="sheet">
        <span class="band" :style="{ background: tone.hi, color: tone.bg }">{{ main.month }}</span>
        <span class="day">
          {{ main.day }}
          <svg class="circled" viewBox="0 0 100 80" fill="none"><path d="M78 14C64 4 26 3 12 22 0 39 12 66 44 71c30 4 52-10 50-32C92 20 70 9 46 10" :stroke="tone.hi" stroke-width="4.5" stroke-linecap="round" /></svg>
        </span>
        <span class="weekday">{{ main.weekday }} · {{ main.year }}</span>
      </div>
      <div v-for="(p, i) in torn" :key="i" class="sheet torn" :style="p.style">
        <span class="band" :style="{ background: tone.hi, color: tone.bg }">{{ p.month }}</span>
        <span class="day">{{ p.day }}</span>
        <span class="weekday">{{ p.weekday }} · {{ p.year }}</span>
      </div>
    </div>

    <p v-if="slide.text" class="when rise" style="--d: 1500ms">{{ slide.text }}</p>
    <p v-if="slide.after" class="s-line rise" style="--d: 1650ms">{{ slide.after }}</p>
  </div>
</template>

<style scoped>
.date-scene { justify-content: center; }
.pad {
  position: relative;
  width: calc(50 * var(--u));
  aspect-ratio: 4 / 5;
  margin: calc(6 * var(--u)) 0 calc(5 * var(--u));
  perspective: calc(140 * var(--u));
}
.sheet {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: calc(3 * var(--u));
  background: var(--sheet-bg, #fff);
  color: #1a1a1a;
  box-shadow: 0 calc(1.2 * var(--u)) calc(4 * var(--u)) rgb(0 0 0 / 0.18);
}
.sheet.back {
  transform: translate(calc(1.6 * var(--u)), calc(1.6 * var(--u))) rotate(3deg);
  opacity: 0.55;
}
.band {
  padding: calc(2.4 * var(--u)) 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: calc(4.4 * var(--u));
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.day {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  font-size: calc(24 * var(--u));
  font-weight: 700;
  letter-spacing: -0.05em;
  font-variant-numeric: tabular-nums;
}
.weekday {
  padding-bottom: calc(3 * var(--u));
  text-align: center;
  font-size: calc(3.6 * var(--u));
  font-weight: 500;
  opacity: 0.6;
}
.paper .day { font-family: var(--font-mono); font-weight: 600; }

/* The days before tear off the top and fall away; their end state is gone. */
.torn {
  opacity: 0;
  transform-origin: 50% 0;
  animation: tear 900ms cubic-bezier(0.5, 0, 0.75, 0) both;
  animation-delay: var(--t);
}
@keyframes tear {
  from { opacity: 1; transform: none; }
  25% { opacity: 1; transform: rotate(calc(var(--r) * 0.4)); }
  to { opacity: 0; transform: translateY(70%) rotate(var(--r)) scale(0.92); }
}

/* A hand-drawn circle stamps onto the day once it's showing (transform and opacity only). */
.circled {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 82%;
  translate: -50% -50%;
  overflow: visible;
  animation: circle-stamp 520ms var(--ease-pop) both;
  animation-delay: 1750ms;
}
@keyframes circle-stamp {
  from { opacity: 0; transform: scale(1.5) rotate(-24deg); }
}
.when {
  font-family: var(--font-mono);
  font-size: calc(4.2 * var(--u));
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--hi);
}
</style>
