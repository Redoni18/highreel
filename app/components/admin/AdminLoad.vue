<script setup lang="ts">
// An admin page's loading and error states (SPEC M2.15); the page itself once its data is in.
import { Loader2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'

defineProps<{ loading: boolean, error: string | null, ready: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="error" class="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
    <p class="text-[18px] font-semibold">Couldn't load this</p>
    <p class="max-w-md text-[14px] text-muted-foreground">{{ error }}</p>
    <Button variant="outline" @click="$emit('retry')">Try again</Button>
  </div>
  <div v-else-if="!ready" class="flex flex-1 items-center justify-center py-16 text-muted-foreground">
    <Loader2 v-if="loading" class="size-4 animate-spin" />
  </div>
  <slot v-else />
</template>
