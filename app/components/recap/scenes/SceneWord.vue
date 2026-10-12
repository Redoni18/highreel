<script setup lang="ts">
// word (SPEC M2.5 P1): a favourite feature, product or issue, or the best
// moment. The word scales in big on a plate while it repeats in marquee
// bands behind it, alternating solid and outlined, Wrapped-style.
import type { SceneProps } from '~/lib/recap'
import { wordSizeU } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const text = computed(() => `${props.slide.text ?? ''}${props.slide.suffix ?? ''}`)
// Enough copies to cover twice the frame width, so the loop is seamless.
const repeats = computed(() => Math.max(2, Math.min(8, Math.ceil(40 / Math.max(4, text.value.length)))))
const bands = [0, 1, 2, 3, 4, 5, 6]
const size = computed(() => `calc(${wordSizeU(text.value)} * var(--u))`)
</script>

<template>
  <div class="word-scene">
    <div class="wallpaper" aria-hidden="true">
      <div
        v-for="b in bands"
        :key="b"
        class="band"
        :class="{ reverse: b % 2, stroked: b % 2 === 0 }"
        :style="{ '--speed': `${22 + (b % 3) * 5}s`, '--d': `${b * 60}ms` }"
      >
        <span v-for="half in 2" :key="half" class="run">
          <span v-for="r in repeats" :key="r">{{ text }}</span>
        </span>
      </div>
    </div>

    <div class="s-body word">
      <p v-if="slide.before" class="s-line rise" style="--d: 120ms">{{ slide.before }}</p>
      <div class="plate-wrap">
        <p class="plate big-text" :style="{ fontSize: size, color: tone.hi, background: tone.bg }">{{ text }}</p>
      </div>
      <p v-if="slide.after" class="s-line rise" style="--d: 700ms">{{ slide.after }}</p>
      <p v-if="slide.small" class="s-small rise" style="--d: 900ms">{{ slide.small }}</p>
    </div>
  </div>
</template>

<style scoped>
.word-scene {
  position: absolute;
  inset: 0;
}
.wallpaper {
  position: absolute;
  inset: -20% -40%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: calc(3 * var(--u));
  rotate: -12deg;
  pointer-events: none;
}
.band {
  display: flex;
  width: max-content;
  font-size: calc(15 * var(--u));
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  text-transform: uppercase;
  white-space: nowrap;
  color: color-mix(in srgb, currentColor 13%, transparent);
  animation:
    band-in 900ms var(--ease-out) var(--d) both,
    marquee var(--speed) linear infinite;
}
.band.stroked {
  color: transparent;
  -webkit-text-stroke: max(1px, calc(0.28 * var(--u))) color-mix(in srgb, currentColor 30%, transparent);
}
.band.reverse { animation-direction: normal, reverse; }
.run {
  display: flex;
  gap: calc(6 * var(--u));
  padding-right: calc(6 * var(--u));
}
@keyframes marquee {
  to { transform: translateX(-50%); }
}
@keyframes band-in {
  from { opacity: 0; }
}
.word {
  justify-content: center;
  align-items: flex-start;
  gap: calc(3 * var(--u));
}
.plate-wrap {
  margin: calc(2 * var(--u)) 0;
  max-width: 100%;
}
.plate {
  display: inline-block;
  max-width: 100%;
  padding: calc(2.4 * var(--u)) calc(4 * var(--u)) calc(3 * var(--u));
  border-radius: calc(2.4 * var(--u));
  rotate: -2deg;
  transform-origin: 20% 60%;
  overflow-wrap: anywhere;
  animation: plate-in 900ms var(--ease-pop) 260ms both;
}
@keyframes plate-in {
  from { opacity: 0; transform: scale(0.4) rotate(8deg); }
}
.paper .plate { rotate: none; }
</style>
