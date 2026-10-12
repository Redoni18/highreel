<script setup lang="ts">
// One flower from the landing's sprite (LandingShapes.vue must be on the page).
// The symbol carries the viewBox; <use> fills whatever size the svg gets.
import type { ShapeKind } from '~/lib/shapes'

defineProps<{ kind: ShapeKind }>()
</script>

<template>
  <svg aria-hidden="true" focusable="false"><use :href="`#shape-${kind}`" width="100%" height="100%" /></svg>
</template>
