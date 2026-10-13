<script setup lang="ts">
// Figures in short labelled lists (SPEC M2.15), in the style of the overview's
// "Newest accounts": a row per number, the number in mono on the right. A
// figure with `to` opens the list behind it.
import type { FigureGroup } from '#shared/utils/admin'
import { NuxtLink } from '#components'

defineProps<{ groups: FigureGroup[] }>()
</script>

<template>
  <div class="grid gap-x-10 gap-y-8 sm:grid-cols-2" :class="groups.length > 3 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'">
    <section v-for="g in groups" :key="g.title" class="flex min-w-0 flex-col gap-1" :data-figures="g.title">
      <h2 class="text-[13px] font-medium text-muted-foreground">{{ g.title }}</h2>
      <ul class="flex flex-col text-[14px]">
        <li v-for="f in g.figures" :key="f.label" class="border-b border-dashed last:border-0" :data-figure="f.label">
          <component :is="f.to ? NuxtLink : 'div'" :to="f.to" class="row" :class="{ link: f.to }">
            <span v-if="f.flag" class="size-2 shrink-0 rounded-full bg-[var(--shape-marigold)]" aria-hidden="true" />
            <span class="truncate">{{ f.label }}</span>
            <span v-if="f.detail" class="ml-auto shrink-0 truncate text-[12px] text-muted-foreground">{{ f.detail }}</span>
            <span class="shrink-0 font-mono text-[13px] font-medium tabular-nums" :class="{ 'ml-auto': !f.detail }" data-value>{{ f.value }}</span>
          </component>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  height: 36px;
  align-items: center;
  gap: 8px;
}
.link { margin: 0 -8px; padding: 0 8px; border-radius: 8px; }
.link:hover { background: var(--subtle); }
</style>
