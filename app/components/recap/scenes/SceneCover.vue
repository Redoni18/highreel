<script setup lang="ts">
// Cover (SPEC M2.5 P1): background shapes fly in and assemble, the mark pops
// in, the title's words rise one by one behind a mask. Pure CSS, so it plays
// from the server-rendered HTML before any JavaScript has loaded.
import type { SceneProps } from '~/lib/recap'
import { mix } from '#shared/utils/color'

const props = defineProps<SceneProps>()

const business = computed(() => props.payload.business.name)
const words = computed(() => (props.slide.title ?? '').split(/\s+/).filter(Boolean))
const pill = computed(() => mix(props.tone.fg, props.tone.bg, 0.22))
</script>

<template>
  <div class="cover-scene">
    <div v-if="!paper" class="shapes" aria-hidden="true">
      <span class="shape disc"><span class="drift" :style="{ background: tone.shape }" /></span>
      <span class="shape hoop"><span class="drift" :style="{ borderColor: tone.shape }" /></span>
      <span class="shape pill"><span class="drift" :style="{ background: pill }" /></span>
    </div>

    <div class="s-body cover">
      <RecapMonogram :name="business" :logo-url="payload.business.logo_url" :shape="payload.business.logo_shape" :bg="tone.fg" :fg="tone.bg" size="calc(15 * var(--u))" class="mark" />
      <div class="cover-text">
        <p class="s-kicker fade-in" style="--d: 180ms">{{ business }} · {{ payload.year }}</p>
        <h1 class="cover-title">
          <template v-for="(w, i) in words" :key="i"><span class="mask"><span class="wi" :style="{ '--d': `${260 + i * 70}ms` }">{{ w }}</span></span>{{ i < words.length - 1 ? ' ' : '' }}</template>
        </h1>
        <span v-if="paper" class="paper-bar" :style="{ background: tone.shape, '--d': `${380 + words.length * 70}ms` }" aria-hidden="true" />
      </div>
      <p class="hint rise" style="--d: 1300ms">Tap to start →</p>
    </div>
  </div>
</template>

<style scoped>
.cover-scene {
  position: absolute;
  inset: 0;
}
.shape {
  position: absolute;
  display: block;
  animation: assemble 1100ms var(--ease-soft) both;
}
.drift {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 9999px;
}
.disc {
  top: calc(-18 * var(--u));
  right: calc(-24 * var(--u));
  width: calc(82 * var(--u));
  height: calc(82 * var(--u));
  --fx: calc(40 * var(--u));
  --fy: calc(-50 * var(--u));
  --fr: 0deg;
}
.disc .drift { animation: drift-disc 16s ease-in-out 1.2s infinite alternate; }
.hoop {
  top: calc(64 * var(--u));
  left: calc(-16 * var(--u));
  width: calc(44 * var(--u));
  height: calc(44 * var(--u));
  animation-delay: 110ms;
  --fx: calc(-50 * var(--u));
  --fy: calc(10 * var(--u));
  --fr: -90deg;
}
.hoop .drift {
  border: calc(6.5 * var(--u)) solid;
  animation: drift-ring 19s ease-in-out 1.2s infinite alternate;
}
.pill {
  top: calc(88 * var(--u));
  right: calc(8 * var(--u));
  width: calc(34 * var(--u));
  height: calc(13 * var(--u));
  rotate: -24deg;
  animation-delay: 220ms;
  --fx: calc(40 * var(--u));
  --fy: calc(30 * var(--u));
  --fr: 120deg;
}
.pill .drift { animation: drift-pill 13s ease-in-out 1.2s infinite alternate; }
@keyframes assemble {
  from { opacity: 0; transform: translate(var(--fx), var(--fy)) rotate(var(--fr)) scale(0.3); }
}
@keyframes drift-disc {
  to { transform: translate(calc(-5 * var(--u)), calc(6 * var(--u))) scale(1.05); }
}
@keyframes drift-ring {
  to { transform: translate(calc(5 * var(--u)), calc(-4 * var(--u))) rotate(30deg); }
}
@keyframes drift-pill {
  to { transform: translate(calc(-6 * var(--u)), calc(-3 * var(--u))) rotate(10deg); }
}
.cover { justify-content: space-between; }
.mark {
  animation: pop 760ms var(--ease-pop) 120ms both;
  transform-origin: 30% 70%;
}
@keyframes pop {
  from { opacity: 0; transform: scale(0.2) rotate(-12deg); }
}
.cover-text { margin-top: auto; }
.s-kicker { margin-bottom: calc(3 * var(--u)); }
.cover-title {
  font-size: calc(11.5 * var(--u));
  line-height: 1.02;
  font-weight: 700;
  letter-spacing: -0.035em;
  text-wrap: balance;
}
.recap .paper .cover-title { letter-spacing: -0.045em; }
.paper-bar {
  display: block;
  width: calc(18 * var(--u));
  height: calc(2 * var(--u));
  margin-top: calc(5 * var(--u));
  transform-origin: left;
  animation: bar 700ms var(--ease-out) both;
  animation-delay: var(--d);
}
@keyframes bar {
  from { transform: scaleX(0); }
}
.hint {
  margin-top: calc(8 * var(--u));
  font-size: calc(4 * var(--u));
  font-weight: 500;
  opacity: 0.75;
}
</style>
