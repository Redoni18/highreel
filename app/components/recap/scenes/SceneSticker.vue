<script setup lang="ts">
// sticker (SPEC M2.10): the word on a sticker that slaps onto the slide with
// a bounce, a white die-cut edge and a peeled corner, while a few small
// stickers pop on around it. Seeded tilt, so every recap's sticker sits its
// own way.
import type { SceneProps } from '~/lib/recap'
import { readableOn } from '#shared/utils/color'
import { seeded } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const text = computed(() => `${props.slide.text ?? ''}${props.slide.suffix ?? ''}`)
const ink = computed(() => readableOn(props.tone.hi))
const size = computed(() => {
  const n = text.value.length
  return `calc(${n <= 8 ? 11 : n <= 14 ? 8.6 : n <= 24 ? 6.6 : 5.2} * var(--u))`
})
const tilt = computed(() => {
  const rand = seeded(`sticker|${props.slide.key}|${text.value}`)
  return `${(-7 + rand() * 4).toFixed(1)}deg`
})
const minis = [
  { key: 0, shape: 'star', x: 12, y: 18, s: 10, r: -14, d: 900 },
  { key: 1, shape: 'dot', x: 80, y: 26, s: 7, r: 0, d: 1050 },
  { key: 2, shape: 'heart', x: 74, y: 76, s: 9, r: 12, d: 1200 },
]
</script>

<template>
  <div class="s-body stk" :style="{ '--hi': tone.hi, '--fg': tone.fg, '--bg': tone.bg }">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <div class="stk-spot">
      <p class="stk-sticker" :style="{ fontSize: size, color: ink, '--tilt': tilt }">
        {{ text }}<span class="stk-peel" aria-hidden="true" />
      </p>
    </div>
    <p v-if="slide.after" class="s-line rise" style="--d: 700ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 900ms">{{ slide.small }}</p>
    <span
      v-for="m in minis"
      :key="m.key"
      class="stk-mini"
      :class="`stk-${m.shape}`"
      aria-hidden="true"
      :style="{ left: `${m.x}%`, top: `${m.y}%`, width: `calc(${m.s} * var(--u))`, rotate: `${m.r}deg`, '--d': `${m.d}ms` }"
    />
  </div>
</template>

<style scoped>
.stk { justify-content: center; gap: calc(4 * var(--u)); }
.stk-spot { margin: calc(4 * var(--u)) 0; }
.stk-sticker {
  position: relative;
  display: inline-block;
  max-width: 100%;
  padding: 0.38em 0.6em 0.44em;
  border-radius: 0.36em;
  background: var(--hi);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
  box-shadow: 0 0 0 calc(1.6 * var(--u)) #FFFFFF, 0 calc(2 * var(--u)) calc(5 * var(--u)) rgb(0 0 0 / 0.28);
  rotate: var(--tilt);
  animation: stk-slap 760ms var(--ease-pop) 260ms both;
}
@keyframes stk-slap {
  from { opacity: 0; transform: scale(1.9) rotate(14deg); }
  40% { opacity: 1; }
}
/* A peeled corner: the sticker's back, folded over. */
.stk-peel {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 0.7em;
  height: 0.7em;
  border-radius: 0 0 0.36em 0;
  background: linear-gradient(135deg, #E9E9E9 50%, transparent 50%);
  box-shadow: calc(-0.5 * var(--u)) calc(-0.5 * var(--u)) calc(1.2 * var(--u)) rgb(0 0 0 / 0.18);
}
.stk-mini {
  position: absolute;
  aspect-ratio: 1;
  background: #FFFFFF;
  animation: stk-pop 500ms var(--ease-pop) var(--d) both;
}
.stk-dot { border-radius: 50%; box-shadow: inset 0 0 0 calc(1.6 * var(--u)) var(--hi); }
.stk-star,
.stk-heart {
  -webkit-mask: var(--m) center / contain no-repeat;
  mask: var(--m) center / contain no-repeat;
  background: color-mix(in srgb, var(--fg) 85%, transparent);
}
.stk-star { --m: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='m12 1.5 3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L12 18l-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1Z'/%3E%3C/svg%3E"); }
.stk-heart { --m: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 21.6S1.8 15.4 1.8 8.4C1.8 5 4.3 2.6 7.3 2.6c2 0 3.6 1 4.7 2.6 1.1-1.6 2.7-2.6 4.7-2.6 3 0 5.5 2.4 5.5 5.8 0 7-10.2 13.2-10.2 13.2Z'/%3E%3C/svg%3E"); }
@keyframes stk-pop { from { opacity: 0; transform: scale(0); } }
</style>
