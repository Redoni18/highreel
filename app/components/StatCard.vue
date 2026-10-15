<script setup lang="ts">
// A headline number at the top of a page (SPEC M2.16): the landing's grey
// rounded card with a label, one big number and one quiet line under it.
// Owner, 2026-10-15: the business home and the admin pages open with a few of
// these for a quick glance; the details stay in lists and tables under them.
// With `to` the card opens the list behind the number.
import { ArrowUpRight } from '@lucide/vue'
import { NuxtLink } from '#components'

defineProps<{
  label: string
  value: string
  detail?: string
  to?: string
  /** worth a look: a marigold dot before the detail */
  flag?: boolean
}>()
</script>

<template>
  <component :is="to ? NuxtLink : 'div'" :to="to" class="stat group" :class="{ link: to }" :data-stat="label">
    <span class="flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
      <span class="truncate">{{ label }}</span>
      <ArrowUpRight v-if="to" class="ml-auto size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
    </span>
    <span class="value" data-value>{{ value }}</span>
    <span v-if="detail" class="flex items-center gap-1.5 text-[13px] leading-snug text-muted-foreground" data-detail>
      <span v-if="flag" class="size-2 shrink-0 rounded-full bg-[var(--shape-marigold)]" aria-hidden="true" />
      <span class="min-w-0">{{ detail }}</span>
    </span>
  </component>
</template>

<style scoped>
.stat {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px 15px;
  border-radius: 20px;
  background: var(--muted);
  transition: background-color 150ms ease, transform 220ms cubic-bezier(0.25, 1.35, 0.45, 1);
}
.link:hover { background: color-mix(in oklab, var(--foreground) 7%, var(--muted)); }
.link:active { transform: scale(0.985); }
.value {
  overflow: hidden;
  font-size: 30px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
