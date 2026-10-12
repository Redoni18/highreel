<script setup lang="ts">
// photo (SPEC M2.5 P1): a group photo as a polaroid that drops and settles,
// develops from white, zooms slowly, and gets its caption typed in.
// Alternate photos tilt the other way.
import type { SceneProps } from '~/lib/recap'

const props = defineProps<SceneProps>()

const photo = computed(() => props.slide.photo!)
const tilt = computed(() => (photo.value.index % 2 ? 3 : -3))
// Square-ish like a real polaroid, but follow the photo between 4:5 and 5:4.
const ratio = computed(() => Math.min(1.25, Math.max(0.8, photo.value.width / Math.max(1, photo.value.height))))
const chars = computed(() => [...photo.value.caption.slice(0, 80)])
const TYPE_AT = 1250
const perChar = computed(() => Math.max(22, Math.min(45, 1600 / Math.max(1, chars.value.length))))
</script>

<template>
  <div class="photo-scene">
    <figure class="polaroid" :style="{ '--tilt': `${tilt}deg` }" :aria-label="photo.caption || `Photo from ${payload.business.name}`">
      <div class="frame" :style="{ aspectRatio: String(ratio) }">
        <img :src="photo.url" alt="" class="photo" draggable="false">
        <span class="develop" aria-hidden="true" />
      </div>
      <figcaption class="caption" aria-hidden="true">
        <span><span v-for="(c, i) in chars" :key="i" class="ch" :style="{ '--d': `${TYPE_AT + Math.round(i * perChar)}ms` }">{{ c }}</span></span>
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.photo-scene {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding-bottom: calc(6 * var(--u));
}
.polaroid {
  width: calc(78 * var(--u));
  padding: calc(4 * var(--u)) calc(4 * var(--u)) 0;
  background: #FBFBF8;
  color: #1A1A1A;
  border-radius: calc(0.8 * var(--u));
  box-shadow: 0 calc(1.5 * var(--u)) calc(5 * var(--u)) rgb(0 0 0 / 0.28);
  rotate: var(--tilt);
  animation: drop 1100ms var(--ease-drop) 120ms both;
}
@keyframes drop {
  from { transform: translateY(-115cqh) rotate(-14deg); }
}
.frame {
  position: relative;
  overflow: hidden;
  background: #222;
}
.photo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: zoom 7s ease-out both;
}
@keyframes zoom {
  from { transform: scale(1.12); }
}
.develop {
  position: absolute;
  inset: 0;
  background: #FBFBF8;
  opacity: 0;
  animation: develop 2400ms ease-out 900ms both;
}
@keyframes develop {
  from { opacity: 0.92; }
}
.caption {
  min-height: calc(16 * var(--u));
  display: grid;
  place-items: center;
  padding: calc(3 * var(--u)) calc(2 * var(--u));
  text-align: center;
  font-size: calc(5 * var(--u));
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  white-space: pre-wrap;
}
.ch {
  animation: rcp-fade 120ms linear var(--d) both;
}
</style>
