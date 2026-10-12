<script setup lang="ts">
// The landing's shape sprite: every flower is defined once here and drawn
// with <LandingShape kind="…">. Shapes take their colour from `color`.
import { DAISY_RAYS, SHAPE_PATHS } from '~/lib/shapes'

const rays = Array.from({ length: DAISY_RAYS }, (_, i) => {
  const a = (i / DAISY_RAYS) * Math.PI * 2
  return { x: Math.round(Math.cos(a) * 760) / 10, y: Math.round(Math.sin(a) * 760) / 10 }
})
</script>

<template>
  <svg width="0" height="0" class="sprite" aria-hidden="true" focusable="false">
    <symbol v-for="(d, kind) in SHAPE_PATHS" :id="`shape-${kind}`" :key="kind" viewBox="-100 -100 200 200">
      <path :d="d" fill="currentColor" />
    </symbol>
    <symbol id="shape-daisy" viewBox="-100 -100 200 200">
      <g stroke="currentColor" stroke-width="27" stroke-linecap="round">
        <line v-for="(r, i) in rays" :key="i" x1="0" y1="0" :x2="r.x" :y2="r.y" />
      </g>
      <circle r="34" fill="currentColor" />
    </symbol>
  </svg>
</template>

<style scoped>
.sprite { position: absolute; overflow: hidden; }
</style>
