<script setup lang="ts">
// Bottom bar (SPEC §6.1, M2.6): search across text columns, the status
// filter with its counts, the selected cell's problem, and Upload.
import { Search, Upload } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { RowFilter } from '~/composables/useWorkspace'

const ws = useWorkspace()
const n = computed(() => ws.counts.value)
const fmt = (x: number) => x.toLocaleString('en-US')

const filters = computed(() => [
  { value: 'all', label: 'All', count: n.value.total },
  { value: 'errors', label: 'Needs fixing', count: n.value.errors },
  { value: 'ready', label: 'Ready', count: n.value.ready },
  { value: 'published', label: 'Published', count: n.value.published },
])

const status = computed(() => {
  const cell = ws.activeCell.value
  const row = cell && ws.rows.value.find(r => r.id === cell.rowId)
  if (row && cell) {
    const error = row.errors[cell.colId]
    if (error)
      return { text: `Row ${row.row_index + 1} · ${cell.colId}: ${error}`, error: true }
  }
  if (ws.search.value && !ws.visibleRows.value.length)
    return { text: 'No rows match', error: false }
  return { text: 'Enter to edit · Esc to cancel · P to toggle preview', error: false }
})

function setFilter(v: unknown) {
  if (typeof v === 'string' && v)
    ws.filter.value = v as RowFilter
}
</script>

<template>
  <footer class="flex h-11 shrink-0 items-center gap-3 border-t px-3">
    <label class="relative flex h-8 w-64 min-w-44 shrink items-center">
      <Search class="pointer-events-none absolute left-3 size-3.5 text-muted-foreground" />
      <input
        id="grid-search"
        v-model="ws.search.value"
        type="search"
        placeholder="Search names, ids, emails…"
        class="h-full w-full rounded-full border border-transparent bg-muted pr-11 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background"
        @keydown.esc="ws.search.value = ''"
      >
      <kbd v-if="!ws.search.value" class="pointer-events-none absolute right-2.5 rounded-md bg-background px-1.5 font-mono text-[10px] text-muted-foreground">⌘F</kbd>
    </label>

    <ToggleGroup type="single" :spacing="0.5" :model-value="ws.filter.value" class="rounded-full bg-muted p-0.5" @update:model-value="setFilter">
      <ToggleGroupItem
        v-for="f in filters"
        :key="f.value"
        :value="f.value"
        :data-filter="f.value"
        :data-count="f.count"
        class="h-7 gap-1.5 rounded-full px-3 text-[13px] font-medium hover:bg-background/70 data-[state=on]:bg-foreground data-[state=on]:text-background"
      >
        {{ f.label }}
        <span
          class="font-mono text-[11px] tabular-nums"
          :class="f.value === 'errors' && f.count && ws.filter.value !== 'errors' ? 'text-destructive' : 'opacity-60'"
        >{{ fmt(f.count) }}</span>
      </ToggleGroupItem>
    </ToggleGroup>

    <p class="ml-auto min-w-0 truncate text-[13px]" :class="status.error ? 'font-medium text-destructive' : 'text-muted-foreground'">
      {{ status.text }}
    </p>
    <Button v-if="!ws.isPublished.value" variant="outline" size="sm" class="shrink-0" @click="ws.pickFile()">
      <Upload /> Upload
    </Button>
  </footer>
</template>
