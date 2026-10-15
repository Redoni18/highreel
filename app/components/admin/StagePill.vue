<script setup lang="ts">
// Where an account has got to, on Users (SPEC M2.16): new, draft, published
// (never paid), paying. Grey until it's out; green once it pays.
import { type Stage, STAGES } from '#shared/utils/admin'

defineProps<{ stage: Stage }>()
const TONE: Record<Stage, string> = {
  new: 'bg-muted text-muted-foreground',
  draft: 'bg-muted text-foreground',
  published: 'bg-primary/12 text-primary',
  paying: 'bg-ok/12 text-ok-text',
}
</script>

<template>
  <span class="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap" :class="TONE[stage]" :title="STAGES[stage].hint" :data-stage="stage">
    {{ STAGES[stage].label }}
  </span>
</template>
