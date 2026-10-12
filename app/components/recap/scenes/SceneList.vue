<script setup lang="ts">
// Three more ways to show a list (SPEC M2.10), the same items the timeline
// shows (a business's milestones, or a list of a customer's own columns):
// receipt (it prints out line by line, the business at the top, a barcode at
// the bottom), cards (each item dealt on its own card, slightly askew) and
// checklist (items tick off one by one).
import type { SceneProps } from '~/lib/recap'
import { readableOn } from '#shared/utils/color'
import { seeded } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const kind = computed(() => props.slide.scene as 'receipt' | 'cards' | 'checklist')
const items = computed(() => (props.slide.items ?? []).slice(0, 5))
const ink = computed(() => readableOn(props.tone.hi))
const at = (i: number) => `${(kind.value === 'receipt' ? 900 : 500) + i * (kind.value === 'cards' ? 380 : 330)}ms`
const tilts = computed(() => {
  const rand = seeded(`list|${props.slide.key}|${items.value.length}`)
  return items.value.map((_, i) => `${((i % 2 ? 1 : -1) * (1 + rand() * 2.2)).toFixed(1)}deg`)
})
const long = computed(() => items.value.some(i => i.text.length > 28))
// A barcode: seeded bar widths, the same for the same recap.
const bars = computed(() => {
  const rand = seeded(`barcode|${props.payload.business.name}|${props.payload.year}`)
  return Array.from({ length: 34 }, (_, i) => ({ key: i, w: rand() < 0.3 ? 2 : 1 }))
})
</script>

<template>
  <div class="s-body lst" :class="`lst-${kind}`" :style="{ '--hi': tone.hi, '--fg': tone.fg, '--bg': tone.bg }">
    <p v-if="slide.before && kind !== 'receipt'" class="s-kicker rise" style="--d: 100ms">{{ slide.before }}</p>

    <!-- Receipt -->
    <div v-if="kind === 'receipt'" class="lst-printer">
      <div class="lst-paper" :class="{ long }">
        <p class="lst-head">{{ payload.business.name }}</p>
        <p class="lst-sub">{{ slide.before || payload.year }}</p>
        <p class="lst-rule" />
        <div v-for="(item, i) in items" :key="i" class="lst-line" :style="{ '--d': at(i) }">
          <span v-if="item.label" class="lst-key">{{ item.label }}</span>
          <span class="lst-val">{{ item.text }}</span>
        </div>
        <p class="lst-rule" />
        <p class="lst-thanks" :style="{ '--d': at(items.length) }">Thank you · {{ payload.year }}</p>
        <div class="lst-code" aria-hidden="true"><i v-for="b in bars" :key="b.key" :style="{ flexGrow: b.w }" /></div>
      </div>
    </div>

    <!-- Cards -->
    <ol v-else-if="kind === 'cards'" class="lst-deck">
      <li v-for="(item, i) in items" :key="i" class="lst-card" :style="{ '--d': at(i), '--tilt': tilts[i], ...(i === 0 ? { background: tone.hi, color: ink } : {}) }">
        <p v-if="item.label" class="lst-card-label">{{ item.label }}</p>
        <p class="lst-card-text" :class="{ long }">{{ item.text }}</p>
      </li>
    </ol>

    <!-- Checklist -->
    <ul v-else class="lst-checks">
      <li v-for="(item, i) in items" :key="i" class="lst-check" :style="{ '--d': at(i) }">
        <span class="lst-box" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4.2L19 7" /></svg></span>
        <span class="min-w-0">
          <span v-if="item.label" class="lst-check-label">{{ item.label }}</span>
          <span class="lst-check-text" :class="{ long }">{{ item.text }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.lst { justify-content: center; gap: calc(4 * var(--u)); }

/* Receipt: paper rolls up out of the slot in jerks, like a printer. */
.lst-printer {
  position: relative;
  overflow: hidden;
  margin: 0 calc(4 * var(--u));
  padding-bottom: calc(2 * var(--u));
}
.lst-paper {
  padding: calc(6 * var(--u)) calc(6 * var(--u)) calc(7 * var(--u));
  background: #FFFDF8;
  color: #1F1F1F;
  font-family: var(--font-mono);
  font-size: calc(3.8 * var(--u));
  line-height: 1.35;
  /* a torn, zigzag bottom edge */
  -webkit-mask: linear-gradient(#000 0 0) top / 100% calc(100% - 2.4 * var(--u)) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / calc(4 * var(--u)) calc(2.4 * var(--u)) repeat-x;
  mask: linear-gradient(#000 0 0) top / 100% calc(100% - 2.4 * var(--u)) no-repeat, conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / calc(4 * var(--u)) calc(2.4 * var(--u)) repeat-x;
  animation: lst-print 1800ms steps(9, end) 200ms both;
}
@keyframes lst-print { from { transform: translateY(-100%); } }
.lst-head {
  font-size: calc(5 * var(--u));
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.lst-sub { text-align: center; opacity: 0.7; }
.lst-rule { margin: calc(3 * var(--u)) 0; border-top: calc(0.4 * var(--u)) dashed #1F1F1F; opacity: 0.4; }
.lst-line {
  display: flex;
  justify-content: space-between;
  gap: calc(3 * var(--u));
  padding: calc(1 * var(--u)) 0;
  animation: rcp-fade 300ms ease-out var(--d) both;
}
.lst-paper.long .lst-line { flex-direction: column; gap: 0; }
.lst-key { opacity: 0.65; text-transform: uppercase; letter-spacing: 0.04em; }
.lst-val { font-weight: 700; text-align: right; overflow-wrap: anywhere; }
.lst-paper.long .lst-val { text-align: left; }
.lst-thanks { text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; animation: rcp-fade 300ms ease-out var(--d) both; }
.lst-code {
  display: flex;
  gap: calc(0.5 * var(--u));
  height: calc(9 * var(--u));
  margin: calc(4 * var(--u)) calc(6 * var(--u)) 0;
}
.lst-code i { flex-basis: 0; background: #1F1F1F; }

/* Cards: dealt from below, each a little askew. */
.lst-deck {
  display: flex;
  flex-direction: column;
  gap: calc(2.6 * var(--u));
}
.lst-card {
  padding: calc(4 * var(--u)) calc(5 * var(--u));
  border-radius: calc(3.4 * var(--u));
  background: color-mix(in srgb, var(--fg) 10%, var(--bg));
  box-shadow: 0 calc(1.4 * var(--u)) calc(4 * var(--u)) rgb(0 0 0 / 0.18);
  rotate: var(--tilt);
  animation: lst-deal 640ms var(--ease-soft) var(--d) both;
}
@keyframes lst-deal { from { opacity: 0; transform: translateY(calc(70 * var(--u))) rotate(-24deg); } }
.lst-card-label { font-size: calc(3.6 * var(--u)); font-weight: 600; opacity: 0.75; }
.lst-card-text { font-size: calc(6.4 * var(--u)); font-weight: 750; line-height: 1.1; letter-spacing: -0.02em; }
.lst-card-text.long { font-size: calc(5 * var(--u)); }

/* Checklist: a box per item, ticked in turn. */
.lst-checks {
  display: flex;
  flex-direction: column;
  gap: calc(5 * var(--u));
}
.lst-check {
  display: flex;
  align-items: flex-start;
  gap: calc(4 * var(--u));
  animation: rcp-rise 500ms var(--ease-out) var(--d) both;
}
.lst-box {
  display: grid;
  flex: none;
  place-items: center;
  width: calc(9 * var(--u));
  height: calc(9 * var(--u));
  border-radius: calc(2.4 * var(--u));
  background: var(--hi);
}
.lst-box svg {
  width: 72%;
  height: 72%;
  stroke: var(--bg);
  stroke-width: 3.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: lst-tick 420ms var(--ease-pop) calc(var(--d) + 260ms) both;
}
@keyframes lst-tick { from { opacity: 0; transform: scale(0) rotate(-30deg); } }
.lst-check-label { display: block; font-size: calc(3.6 * var(--u)); font-weight: 600; opacity: 0.75; }
.lst-check-text { display: block; font-size: calc(6.4 * var(--u)); font-weight: 700; line-height: 1.12; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.lst-check-text.long { font-size: calc(5 * var(--u)); }
</style>
