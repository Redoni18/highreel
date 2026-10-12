<script setup lang="ts">
// A stat slide whose custom copy has no {column} placeholder: just the line.
import type { SceneProps } from '~/lib/recap'

defineProps<SceneProps>()
</script>

<template>
  <div class="s-body line-scene">
    <p class="big-text rise" style="--d: 120ms; font-size: calc(10 * var(--u))">{{ slide.before }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 400ms">{{ slide.small }}</p>
  </div>
</template>

<style scoped>
.line-scene { justify-content: center; gap: calc(5 * var(--u)); }
</style>
