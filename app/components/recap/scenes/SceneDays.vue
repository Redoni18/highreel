<script setup lang="ts">
// days (SPEC M2.5 P1): a count out of a year, or the days of one visit. The
// year is 12 small month grids with real weekdays; days light up in order as
// the number counts, so 212 fills a little more than half the year. A short
// visit gets a tear-off calendar page per day.
import type { SceneProps } from '~/lib/recap'
import { formatNumber } from '#shared/utils/slides'
import { bigSizeU, daysLayout, stepTimes, visitPages, yearCalendar } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const START = 500
const FILL = 2200

const value = computed(() => Math.max(0, props.slide.value ?? 0))
const span = computed(() => props.slide.days?.span ?? 'year')
const layout = computed(() => daysLayout(value.value, span.value))
const calendar = computed(() => yearCalendar(props.slide.days?.year ?? new Date().getFullYear()))
const lit = computed(() => Math.min(value.value, layout.value === 'year' ? calendar.value.total : value.value))
const times = computed(() => stepTimes(lit.value, FILL, START))
const pages = computed(() => visitPages(value.value, props.slide.days?.start ?? null))

const chars = computed(() => formatNumber(value.value).length + (props.slide.prefix?.length ?? 0) + (props.slide.suffix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value, layout.value === 'year' ? 26 : 30).toFixed(1)} * var(--u))`)
const at = (i: number) => ({ '--t': `${times.value[i] ?? 0}ms` })
</script>

<template>
  <div class="s-body days" :class="`is-${layout}`" :style="{ '--hi': tone.hi }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <p class="big rise" style="--d: 160ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="value" :delay="START" :duration="FILL" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 240ms">{{ slide.after }}</p>

    <div v-if="layout === 'year'" class="year rise" style="--d: 300ms" aria-hidden="true">
      <div v-for="m in calendar.months" :key="m.first" class="month">
        <span class="m-label">{{ m.label }}</span>
        <div class="m-grid">
          <span v-for="k in m.lead" :key="`p${k}`" />
          <span
            v-for="d in m.days"
            :key="d"
            class="cell"
            :class="{ lit: m.first + d - 1 < lit }"
            :style="m.first + d - 1 < lit ? at(m.first + d - 1) : undefined"
          />
        </div>
      </div>
    </div>

    <div v-else-if="layout === 'pages'" class="pages" :style="{ '--n': value }" aria-hidden="true">
      <div v-for="(p, i) in pages" :key="i" class="page" :style="at(i)">
        <span class="p-top" :style="{ background: tone.hi, color: tone.bg }">{{ p.top }}</span>
        <span class="p-day">{{ p.day }}</span>
      </div>
    </div>

    <div v-else class="tiles" aria-hidden="true">
      <span v-for="i in value" :key="i" class="cell lit" :style="at(i - 1)" />
    </div>

    <p v-if="slide.small" class="s-small rise" :style="{ '--d': `${START + FILL - 400}ms` }">{{ slide.small }}</p>
  </div>
</template>

<style scoped>
.days { justify-content: center; }
.big { margin: calc(1.5 * var(--u)) 0 calc(2 * var(--u)); }
.year {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: calc(2.6 * var(--u)) calc(2.6 * var(--u));
  margin-top: calc(6 * var(--u));
}
.m-label {
  display: block;
  margin-bottom: calc(0.9 * var(--u));
  font-family: var(--font-mono);
  font-size: calc(2.8 * var(--u));
  line-height: 1;
  opacity: 0.6;
}
.m-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: calc(0.5 * var(--u));
}
.cell {
  position: relative;
  aspect-ratio: 1;
  border-radius: 24%;
  background: color-mix(in srgb, currentColor 14%, transparent);
}
.cell.lit::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--hi);
  animation: cell-pop 460ms var(--ease-pop) both;
  animation-delay: var(--t);
}
@keyframes cell-pop {
  from { opacity: 0; transform: scale(0.1); }
}
.tiles {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: calc(1.6 * var(--u));
  margin-top: calc(6 * var(--u));
  max-width: calc(64 * var(--u));
}
.pages {
  display: flex;
  gap: calc(3 * var(--u));
  margin-top: calc(7 * var(--u));
  perspective: calc(120 * var(--u));
}
.page {
  display: flex;
  flex-direction: column;
  width: min(calc(26 * var(--u)), calc((84 * var(--u) - (var(--n) - 1) * 3 * var(--u)) / var(--n)));
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border-radius: calc(2.6 * var(--u));
  background: color-mix(in srgb, currentColor 11%, transparent);
  transform-origin: top center;
  animation: page-flip 700ms var(--ease-drop) both;
  animation-delay: var(--t);
}
@keyframes page-flip {
  from { opacity: 0; transform: rotateX(-100deg); }
  30% { opacity: 1; }
}
.p-top {
  padding: calc(1.6 * var(--u)) 0;
  text-align: center;
  font-family: var(--font-mono);
  font-size: calc(3 * var(--u));
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.p-day {
  flex: 1;
  display: grid;
  place-items: center;
  font-size: calc(min(11, 30 / var(--n)) * var(--u));
  font-weight: 700;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}
.paper .p-day { font-family: var(--font-mono); font-weight: 600; }
</style>
