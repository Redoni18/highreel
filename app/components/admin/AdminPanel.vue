<script setup lang="ts">
// A box on the admin pages (SPEC M2.16): a title, a link to the list behind
// it, and what it holds. Outlined, so the grey cards above stay the first
// thing to read.
import { ArrowRight } from '@lucide/vue'

defineProps<{ title: string, to?: string, linkLabel?: string }>()
</script>

<template>
  <section class="flex min-w-0 flex-col gap-2 rounded-[20px] border px-5 pt-4 pb-3">
    <h2 class="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
      {{ title }}
      <NuxtLink v-if="to" :to="to" class="group ml-auto inline-flex items-center gap-1 text-[13px] font-normal text-muted-foreground hover:text-foreground">
        {{ linkLabel ?? 'See all' }} <ArrowRight class="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </NuxtLink>
    </h2>
    <slot />
  </section>
</template>
