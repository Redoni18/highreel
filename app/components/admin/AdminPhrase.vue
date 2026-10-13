<script setup lang="ts">
// A sentence from shared/utils/admin.ts with its numbers set in bold (SPEC M2.15).
import type { Phrase } from '#shared/utils/home'

defineProps<{ phrase: Phrase }>()
</script>

<template>
  <template v-for="(part, i) in phrase" :key="i"><span v-if="typeof part === 'string'">{{ part }}</span><span v-else class="font-bold text-foreground">{{ part.n }}</span></template>
</template>
