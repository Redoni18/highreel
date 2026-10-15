<script setup lang="ts">
// A group of figures in a panel (SPEC M2.15, in a panel since M2.16): a row
// per number, its share in grey before it, the number in mono on the right.
// A figure with `to` opens the list behind it.
import type { FigureGroup } from '#shared/utils/admin'
import { NuxtLink } from '#components'

defineProps<{ group: FigureGroup }>()
</script>

<template>
  <AdminPanel :title="group.title" :to="group.to" :data-figures="group.title">
    <ul class="flex flex-col text-[14px]">
      <li v-for="f in group.figures" :key="f.label" class="border-b border-dashed last:border-0" :data-figure="f.label">
        <component :is="f.to ? NuxtLink : 'div'" :to="f.to" class="row" :class="{ link: f.to }">
          <span v-if="f.flag" class="size-2 shrink-0 rounded-full bg-[var(--shape-marigold)]" aria-hidden="true" />
          <span class="truncate">{{ f.label }}</span>
          <span v-if="f.detail" class="ml-auto shrink-0 truncate font-mono text-[12px] text-muted-foreground" data-detail>{{ f.detail }}</span>
          <span class="min-w-[4.5rem] shrink-0 text-right font-mono text-[13px] font-medium tabular-nums" :class="{ 'ml-auto': !f.detail }" data-value>{{ f.value }}</span>
        </component>
      </li>
    </ul>
  </AdminPanel>
</template>

<style scoped>
.row {
  display: flex;
  height: 38px;
  align-items: center;
  gap: 10px;
}
.link { margin: 0 -8px; padding: 0 8px; border-radius: 8px; }
.link:hover { background: var(--subtle); }
</style>
