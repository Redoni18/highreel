<script setup lang="ts">
// leaderboard (SPEC M2.10, a "top X %" slide): the brackets of everyone,
// Top 1 %, Top 5 %… Everyone, slide in one by one, each with a bar for how
// many people are in it. Theirs drops in last, highlighted, in its place
// ("You · Top 8 %").
import type { SceneProps } from '~/lib/recap'
import { readableOn } from '#shared/utils/color'
import { bigSizeU } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const top = computed(() => Math.min(100, Math.max(1, Math.round(props.slide.value ?? 100))))
const ink = computed(() => readableOn(props.tone.hi))
const BANDS = [1, 5, 10, 25, 50, 100]
const rows = computed(() => {
  const list: Array<{ key: string, label: string, pct: number, you: boolean }> = BANDS
    .filter(b => b !== top.value)
    .map(b => ({ key: `b${b}`, label: b === 100 ? 'Everyone' : `Top ${b}%`, pct: b, you: false }))
  const at = list.findIndex(r => r.pct > top.value)
  list.splice(at < 0 ? list.length : at, 0, { key: 'you', label: `You · Top ${top.value}%`, pct: top.value, you: true })
  let order = 0
  return list.map(r => ({ ...r, width: `${(18 + Math.sqrt(r.pct) * 8.2).toFixed(1)}%`, d: r.you ? 1700 : 300 + order++ * 170 }))
})
const chars = computed(() => String(top.value).length + (props.slide.prefix?.length ?? 0) + (props.slide.suffix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value, 20).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body ldb" :style="{ '--hi': tone.hi, '--fg': tone.fg }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <p class="big rise" style="--d: 140ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><CountUp :value="top" :from="100" :delay="500" :duration="1300" :reduced="reduced" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 220ms">{{ slide.after }}</p>

    <ol class="ldb-rows" aria-hidden="true">
      <li v-for="r in rows" :key="r.key" class="ldb-row" :class="{ 'ldb-you': r.you }" :style="{ '--d': `${r.d}ms`, ...(r.you ? { background: tone.hi, color: ink } : {}) }">
        <span class="ldb-label">{{ r.label }}</span>
        <span class="ldb-bar" :style="{ width: r.width }" />
      </li>
    </ol>
  </div>
</template>

<style scoped>
.ldb { justify-content: flex-start; padding-top: calc(22 * var(--u)); }
.ldb .big { margin: calc(2 * var(--u)) 0; }
.ldb-rows {
  display: flex;
  flex-direction: column;
  gap: calc(1.8 * var(--u));
  margin-top: auto;
  margin-bottom: calc(2 * var(--u));
}
.ldb-row {
  display: flex;
  align-items: center;
  gap: calc(3 * var(--u));
  padding: calc(2.4 * var(--u)) calc(3.6 * var(--u));
  border-radius: calc(2.4 * var(--u));
  background: color-mix(in srgb, var(--fg) 9%, transparent);
  font-size: calc(4.2 * var(--u));
  font-weight: 600;
  animation: ldb-in 560ms var(--ease-out) var(--d) both;
}
@keyframes ldb-in { from { opacity: 0; transform: translateX(40%); } }
.ldb-you {
  font-weight: 800;
  transform-origin: 50% 50%;
  animation-name: ldb-you;
  animation-timing-function: var(--ease-pop);
}
@keyframes ldb-you { from { opacity: 0; transform: scale(1.25); } }
.ldb-label { flex: none; min-width: calc(30 * var(--u)); }
.ldb-bar {
  height: calc(2 * var(--u));
  margin-left: auto;
  border-radius: 9999px;
  background: currentColor;
  opacity: 0.35;
}
</style>
