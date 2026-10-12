<script setup lang="ts">
// Row status (SPEC §6.2): grey while saving, red needs fixing, green ring
// ready, filled green published.
import type { RowStatus } from '~/composables/useWorkspace'

const props = defineProps<{ status: RowStatus }>()
const label: Record<RowStatus, string> = {
  saving: 'Saving',
  error: 'Needs fixing',
  ready: 'Ready',
  published: 'Published',
}
const cls = computed(() => ({
  saving: 'bg-muted-foreground/40 animate-pulse',
  error: 'bg-destructive',
  ready: 'border-[1.5px] border-ok',
  published: 'bg-ok',
})[props.status])
</script>

<template>
  <span class="block size-2 rounded-full" :class="cls" role="img" :aria-label="label[status]" :title="label[status]" />
</template>
