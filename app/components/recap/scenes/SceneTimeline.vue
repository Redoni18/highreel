<script setup lang="ts">
// timeline (SPEC M2.5 P4): a business's milestones, or (M2.7) a list of a
// customer's own columns. A line draws down the left and each item lands on
// it in turn: a dot pops, its label ("March", "Favourite occasion") and text
// slide in. Up to five; long text and longer lists set smaller.
import type { SceneProps } from '~/lib/recap'

const props = defineProps<SceneProps>()

const items = computed(() => (props.slide.items ?? []).slice(0, 5))
const longest = computed(() => Math.max(0, ...items.value.map(i => i.text.length)))
const many = computed(() => items.value.length > 3)
const textSize = computed(() => `calc(${(longest.value > 56 ? 5.4 : longest.value > 32 ? 6.2 : 7.2) * (many.value ? 0.82 : 1)} * var(--u))`)
const at = (i: number) => `${560 + i * (many.value ? 420 : 520)}ms`
</script>

<template>
  <div class="s-body timeline">
    <p v-if="slide.before" class="s-kicker rise" style="--d: 100ms">{{ slide.before }}</p>
    <ol class="tl" :class="{ many }">
      <span class="tl-line" :style="{ background: tone.hi }" aria-hidden="true" />
      <li v-for="(item, i) in items" :key="i" class="tl-item" :style="{ '--d': at(i) }">
        <span class="tl-dot" :style="{ background: tone.hi, boxShadow: `0 0 0 calc(1.4 * var(--u)) ${tone.bg}` }" aria-hidden="true" />
        <p v-if="item.label" class="tl-label" :style="{ color: tone.hi }">{{ item.label }}</p>
        <p class="tl-text" :style="{ fontSize: textSize }">{{ item.text }}</p>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.timeline { justify-content: center; }
.tl {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: calc(7 * var(--u));
  margin-top: calc(7 * var(--u));
  padding-left: calc(10 * var(--u));
}
.tl.many {
  gap: calc(4.6 * var(--u));
  margin-top: calc(5.5 * var(--u));
}
.tl-line {
  position: absolute;
  left: calc(2.4 * var(--u));
  top: calc(1.8 * var(--u));
  bottom: calc(1.8 * var(--u));
  width: calc(0.8 * var(--u));
  border-radius: 9999px;
  opacity: 0.55;
  transform-origin: top;
  animation: tl-draw 1500ms var(--ease-out) 300ms both;
}
@keyframes tl-draw {
  from { transform: scaleY(0); }
}
.tl-item { position: relative; }
.tl-dot {
  position: absolute;
  left: calc(-10 * var(--u) + 1.2 * var(--u));
  top: calc(1.4 * var(--u));
  width: calc(3.2 * var(--u));
  height: calc(3.2 * var(--u));
  border-radius: 50%;
  animation: tl-pop 640ms var(--ease-pop) var(--d) both;
}
@keyframes tl-pop {
  from { opacity: 0; transform: scale(0); }
}
.tl-label {
  margin-bottom: calc(1.2 * var(--u));
  font-size: calc(3.6 * var(--u));
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  animation: tl-in 700ms var(--ease-out) var(--d) both;
}
.tl-text {
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.02em;
  text-wrap: balance;
  animation: tl-in 760ms var(--ease-out) calc(var(--d) + 80ms) both;
}
@keyframes tl-in {
  from { opacity: 0; transform: translateX(calc(8 * var(--u))); }
}
.paper .tl-dot { border-radius: calc(0.6 * var(--u)); }
.paper .tl-label { font-family: var(--font-mono); letter-spacing: 0.02em; }
</style>
