<script lang="ts">
export interface AdminColumn<T> {
  key: string
  label: string
  /** what the cell shows (numbers are formatted; null is "–") */
  value: (row: T) => string | number | null
  /** what it sorts by, when that isn't what it shows */
  sort?: (row: T) => string | number | null
  /** right-aligned mono numbers */
  num?: boolean
  /** a hint on the header */
  title?: string
  /** a column of buttons: not sorted, and pinned to the right edge while the table scrolls */
  fixed?: boolean
}
</script>

<script setup lang="ts" generic="T">
// The admin pages' tables (SPEC M2.15), in the home table's style
// (RecapsTable): dense rows, numbers in mono, a header click sorts, and a
// row opens its page. A `#cell-<key>` slot draws a cell its own way.
import { ArrowDown, ArrowUp } from '@lucide/vue'

const props = withDefaults(defineProps<{
  columns: AdminColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** the page a row opens */
  to?: (row: T) => string | null
  /** names the table for screen readers */
  label: string
  empty?: string
  minWidth?: number
  /** the column it starts sorted by, and how */
  sortKey?: string
  sortDir?: 'asc' | 'desc'
}>(), { to: undefined, empty: 'Nothing here.', minWidth: 900, sortKey: undefined, sortDir: 'desc' })

const key = ref(props.sortKey)
const dir = ref<'asc' | 'desc'>(props.sortDir)

function sortBy(k: string) {
  if (key.value === k) {
    dir.value = dir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  key.value = k
  // Numbers start biggest first, words from A.
  dir.value = props.columns.find(c => c.key === k)?.num ? 'desc' : 'asc'
}

const sorted = computed(() => {
  const col = props.columns.find(c => c.key === key.value)
  if (!col)
    return props.rows
  const by = col.sort ?? col.value
  const sign = dir.value === 'asc' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const x = by(a)
    const y = by(b)
    // Empty cells go last either way.
    if (x == null || x === '')
      return y == null || y === '' ? 0 : 1
    if (y == null || y === '')
      return -1
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sign
  })
})

const show = (c: AdminColumn<T>, row: T) => {
  const v = c.value(row)
  return v == null || v === '' ? '–' : typeof v === 'number' ? v.toLocaleString('en-US') : v
}

function open(e: MouseEvent, row: T) {
  const to = props.to?.(row)
  // Not from a link, a button or a menu or dialog it opened (they're teleported, but their events still bubble here).
  if (to && !(e.target as HTMLElement).closest('a, button, [role="menu"], [role="dialog"]') && (e.currentTarget as HTMLElement).contains(e.target as Node))
    navigateTo(to)
}
</script>

<template>
  <TableScroll>
    <table class="w-full border-collapse text-left text-[13px]" :style="{ minWidth: `${minWidth}px` }" :aria-label="label">
      <thead class="bg-subtle text-[12px] text-muted-foreground">
        <tr class="h-9 border-b">
          <th
            v-for="c in columns"
            :key="c.key"
            class="px-2 font-medium whitespace-nowrap first:pl-4 last:pr-4"
            :class="{ 'text-right': c.num, pinned: c.fixed }"
            :aria-sort="key === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : undefined"
          >
            <span v-if="c.fixed" class="sr-only">{{ c.label }}</span>
            <button v-else type="button" class="inline-flex items-center gap-1 hover:text-foreground" :class="{ 'text-foreground': key === c.key }" :title="c.title" @click="sortBy(c.key)">
              {{ c.label }}
              <template v-if="key === c.key">
                <ArrowUp v-if="dir === 'asc'" class="size-3" />
                <ArrowDown v-else class="size-3" />
              </template>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in sorted"
          :key="rowKey(row)"
          class="group h-10 border-b last:border-0"
          :class="{ 'cursor-pointer hover:bg-subtle': to?.(row) }"
          :data-row="rowKey(row)"
          @click="open($event, row)"
        >
          <td v-for="(c, i) in columns" :key="c.key" :class="[c.num ? 'num' : 'cell', { pinned: c.fixed, hovers: c.fixed && to?.(row) }]" :data-col="c.key">
            <slot :name="`cell-${c.key}`" :row="row" :value="show(c, row)">
              <NuxtLink v-if="i === 0 && to?.(row)" :to="to(row)!" class="block max-w-[280px] truncate font-medium hover:underline" :title="String(show(c, row))">{{ show(c, row) }}</NuxtLink>
              <template v-else>{{ show(c, row) }}</template>
            </slot>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="columns.length" class="h-14 px-4 text-muted-foreground">{{ empty }}</td>
        </tr>
      </tbody>
    </table>
  </TableScroll>
</template>

<style scoped>
.cell {
  max-width: 280px;
  padding: 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell:first-child { padding-left: 16px; }
.num {
  padding: 0 8px;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.num:last-child, .cell:last-child { padding-right: 16px; }
/* Its own background, so the columns scrolling under it don't show through. */
.pinned {
  position: sticky;
  right: 0;
  background: var(--background);
  box-shadow: inset 1px 0 0 var(--border);
}
thead .pinned { background: var(--subtle); }
.group:hover .hovers { background: var(--subtle); }
</style>
