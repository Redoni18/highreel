<script setup lang="ts">
// The Paid cell on the admin pages (SPEC M2.15): the amount, or a marked
// "not paid" for a published Highreel nobody paid for (a dot: marigold text
// would be too faint on white).
defineProps<{ unpaid: boolean, value: string | number }>()
</script>

<template>
  <span v-if="unpaid" class="inline-flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-[var(--shape-marigold)]" aria-hidden="true" />not paid</span>
  <template v-else>{{ value }}</template>
</template>
