<script setup lang="ts">
// One slide as a still (SPEC M2.13): its end state with nothing moving (scenes'
// base style is their end state, so `is-reduced` is all it takes), sized by its
// box through the same container units as the player. The save picker's cards
// and its peek use it, and so does the image that gets saved. The summary card
// is the drawn share image (`shareUrl`), as before.
import type { RecapPayload } from '#shared/types/recap'
import type { RecapPalette, RecapTheme } from '#shared/utils/color'
import type { Slide } from '#shared/utils/slides'
import { RECAP_CLOCK } from '~/lib/recap'

const props = defineProps<{
  slide: Slide
  payload: RecapPayload
  palette: RecapPalette
  theme: RecapTheme
  position: number
  count: number
  shareUrl?: string | null
}>()

// Count-ups and other clocked bits show their final value.
provide(RECAP_CLOCK, { held: ref(true), reduced: ref(true) })
const tone = computed(() => props.palette[props.slide.tone])
</script>

<template>
  <div class="recap still is-reduced" :class="`theme-${theme}`" :style="{ background: tone.bg, color: tone.fg }" :data-still="slide.key">
    <img v-if="slide.key === 'share'" v-show="shareUrl" :src="shareUrl ?? undefined" alt="" class="share-img" draggable="false">
    <RecapSlide
      v-else
      :slide="slide"
      :payload="payload"
      :tone="tone"
      :palette="palette"
      :theme="theme"
      :reduced="true"
      :position="position"
      :count="count"
    />
  </div>
</template>

<style scoped>
.still {
  /* A still is the whole slide, never framed by a phone's status bar. */
  --recap-inset-top: 0px;
  position: relative;
  container-type: size;
  overflow: hidden;
  font-family: var(--font-sans);
}
.share-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
