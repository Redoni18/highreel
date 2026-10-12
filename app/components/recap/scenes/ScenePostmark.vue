<script setup lang="ts">
// postmark (SPEC M2.10): a date as a postmark. A postcard slides in, then the
// round stamp thumps down on it with the day, the month and the year, wavy
// cancellation lines trailing off, and a stamp with the business's initial
// sits in the corner.
import type { SceneProps } from '~/lib/recap'

const props = defineProps<SceneProps>()

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const parts = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.slide.date ?? '')
  return m ? { day: String(Number(m[3])), month: MONTHS[Number(m[2]) - 1] ?? '', year: m[1]! } : { day: '', month: props.slide.text ?? '', year: '' }
})
const initial = computed(() => props.payload.business.name.trim().charAt(0).toUpperCase())
</script>

<template>
  <div class="s-body pmk" :style="{ '--hi': tone.hi, '--fg': tone.fg, '--bg': tone.bg }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>

    <div class="pmk-card" aria-hidden="true">
      <span class="pmk-lines"><i /><i /><i /></span>
      <span class="pmk-stamp">{{ initial }}</span>
      <div class="pmk-mark">
        <span class="pmk-ring">
          <span class="pmk-month">{{ parts.month }}</span>
          <span class="pmk-day">{{ parts.day }}</span>
          <span class="pmk-year">{{ parts.year }}</span>
        </span>
        <svg class="pmk-waves" viewBox="0 0 120 40" fill="none"><path d="M0 8q7.5-7 15 0t15 0 15 0 15 0 15 0 15 0 15 0 15 0M0 20q7.5-7 15 0t15 0 15 0 15 0 15 0 15 0 15 0 15 0M0 32q7.5-7 15 0t15 0 15 0 15 0 15 0 15 0 15 0 15 0" /></svg>
      </div>
    </div>
    <p class="pmk-text big-text rise" style="--d: 1100ms" :style="{ color: tone.hi }">{{ slide.text }}</p>

    <p v-if="slide.after" class="s-line rise" style="--d: 1300ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 1500ms">{{ slide.small }}</p>
  </div>
</template>

<style scoped>
.pmk { justify-content: center; gap: calc(4 * var(--u)); }
.pmk-card {
  position: relative;
  height: calc(52 * var(--u));
  margin: calc(3 * var(--u)) 0;
  border-radius: calc(2 * var(--u));
  background: #FBF8F1;
  box-shadow: 0 calc(2 * var(--u)) calc(6 * var(--u)) rgb(0 0 0 / 0.2);
  rotate: 2deg;
  animation: pmk-card 700ms var(--ease-out) 100ms both;
}
@keyframes pmk-card { from { opacity: 0; transform: translateX(-30%) rotate(-8deg); } }
.pmk-lines {
  position: absolute;
  right: calc(7 * var(--u));
  bottom: calc(9 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(4.4 * var(--u));
  width: 38%;
}
.pmk-lines i { height: calc(0.5 * var(--u)); background: #D7D2C7; }
.pmk-stamp {
  position: absolute;
  top: calc(5 * var(--u));
  right: calc(6 * var(--u));
  display: grid;
  place-items: center;
  width: calc(14 * var(--u));
  height: calc(17 * var(--u));
  background: var(--hi);
  color: var(--bg);
  font-size: calc(8 * var(--u));
  font-weight: 800;
  outline: calc(1 * var(--u)) dotted #FBF8F1;
  outline-offset: calc(-0.4 * var(--u));
}
.pmk-mark {
  position: absolute;
  left: calc(6 * var(--u));
  top: calc(8 * var(--u));
  display: flex;
  align-items: center;
  color: color-mix(in srgb, #1C2A5C 82%, transparent);
  rotate: -12deg;
  animation: pmk-thump 520ms var(--ease-drop) 650ms both;
}
@keyframes pmk-thump { from { opacity: 0; transform: scale(1.8); } }
.pmk-ring {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: calc(30 * var(--u));
  height: calc(30 * var(--u));
  border-radius: 50%;
  /* two rings: the border, and an outline drawn inside it */
  border: calc(0.8 * var(--u)) solid currentColor;
  outline: calc(0.5 * var(--u)) solid currentColor;
  outline-offset: calc(-3 * var(--u));
  font-family: var(--font-mono);
  font-weight: 700;
  line-height: 1;
}
.pmk-month, .pmk-year { font-size: calc(3.6 * var(--u)); letter-spacing: 0.1em; }
.pmk-day { margin: calc(0.8 * var(--u)) 0; font-size: calc(9 * var(--u)); }
.pmk-waves {
  width: calc(26 * var(--u));
  margin-left: calc(-2 * var(--u));
  stroke: currentColor;
  stroke-width: 2.6;
}
.pmk-text { font-size: calc(8.6 * var(--u)); }
</style>
