<script setup lang="ts">
// The Airtable-style grid (SPEC §6.2): 32px rows, virtual scroll, sticky
// header and first columns, resizable widths, keyboard navigation and
// in-place editing. TanStack Table owns column sizing; TanStack Virtual owns
// which rows are in the DOM.
import { useVirtualizer } from '@tanstack/vue-virtual'
import { type ColumnDef, columnResizingFeature, columnSizingFeature, tableFeatures, useTable } from '@tanstack/vue-table'
import { Activity, AtSign, Calendar, CaseSensitive, Check, Copy, Download, Eye, Hash, Link2, Mail, MailX, MessageCircle, MousePointerClick, Phone, Share2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { Recipient } from '#shared/types/recap'
import type { TemplateColumn } from '#shared/templates/types'

const ws = useWorkspace()
const ROW_H = 32

type Kind = 'row' | 'status' | 'data' | 'link' | 'views' | 'actions'
interface GridColumn {
  id: string
  kind: Kind
  def?: TemplateColumn
  sticky: boolean
  size: number
}

const hasLinks = computed(() => ws.rows.value.some(r => r.token))

const gridColumns = computed<GridColumn[]>(() => {
  const cols = ws.template.value.columns
  const first = cols.find(c => c.key === 'first_name')
  const out: GridColumn[] = [
    { id: '__row', kind: 'row', sticky: true, size: 52 },
    { id: '__status', kind: 'status', sticky: true, size: 28 },
  ]
  if (first)
    out.push({ id: first.key, kind: 'data', def: first, sticky: true, size: first.width })
  for (const c of cols) {
    if (c !== first)
      out.push({ id: c.key, kind: 'data', def: c, sticky: false, size: c.width })
  }
  if (hasLinks.value) {
    out.push({ id: '__link', kind: 'link', sticky: false, size: 210 })
    out.push({ id: '__views', kind: 'views', sticky: false, size: 88 })
    out.push({ id: '__actions', kind: 'actions', sticky: false, size: 144 })
  }
  return out
})
const byId = computed(() => new Map(gridColumns.value.map(c => [c.id, c])))
const editableIds = computed(() => gridColumns.value.filter(c => c.kind === 'data').map(c => c.id))

// --- TanStack Table: column sizing and resizing --------------------------------
const features = tableFeatures({ columnSizingFeature, columnResizingFeature })
const tableColumns = computed((): ColumnDef<typeof features, Recipient>[] => gridColumns.value.map(c => ({
  id: c.id,
  size: c.size,
  minSize: c.kind === 'data' || c.kind === 'link' ? 64 : c.size,
  maxSize: 640,
  enableResizing: c.kind === 'data' || c.kind === 'link',
})))
const table = useTable({
  features,
  columns: tableColumns,
  data: ws.visibleRows,
  getRowId: (r: Recipient) => r.id,
  enableColumnResizing: true,
  columnResizeMode: 'onChange',
})

const headers = computed(() => table.getHeaderGroups()[0]?.headers ?? [])
const sizes = computed(() => {
  const m = new Map<string, number>()
  for (const h of headers.value)
    m.set(h.column.id, h.getSize())
  return m
})
const width = (id: string) => sizes.value.get(id) ?? byId.value.get(id)?.size ?? 100
const lefts = computed(() => {
  const m = new Map<string, number>()
  let x = 0
  for (const c of gridColumns.value) {
    m.set(c.id, x)
    x += width(c.id)
  }
  return m
})
const totalWidth = computed(() => gridColumns.value.reduce((sum, c) => sum + width(c.id), 0))
const stickyWidth = computed(() => gridColumns.value.filter(c => c.sticky).reduce((sum, c) => sum + width(c.id), 0))
const lastStickyId = computed(() => [...gridColumns.value].reverse().find(c => c.sticky)?.id)

// --- Virtual rows ---------------------------------------------------------------
const scroller = ref<HTMLElement | null>(null)
const rows = computed(() => table.getRowModel().rows)
const virtualizer = useVirtualizer(computed(() => ({
  count: rows.value.length,
  getScrollElement: () => scroller.value,
  estimateSize: () => ROW_H,
  getItemKey: (i: number) => rows.value[i]?.id ?? i,
  overscan: 12,
})))
const virtualRows = computed(() => virtualizer.value.getVirtualItems())
const totalHeight = computed(() => virtualizer.value.getTotalSize())

// --- Active cell, selection, editing ------------------------------------------------
const editing = ref<{ rowId: string, colId: string, value: string } | null>(null)
let editInput: HTMLInputElement | null = null
function setEditInput(el: unknown) {
  editInput = el as HTMLInputElement | null
}

function rowIndexOf(rowId: string) {
  return ws.visibleRows.value.findIndex(r => r.id === rowId)
}

function activate(rowId: string, colId: string, scroll = true) {
  ws.activeCell.value = { rowId, colId }
  ws.selectedId.value = rowId
  if (scroll)
    scrollIntoView(rowId, colId)
}

function scrollIntoView(rowId: string, colId: string) {
  const el = scroller.value
  if (!el)
    return
  const index = rowIndexOf(rowId)
  if (index >= 0) {
    const top = index * ROW_H
    const viewTop = el.scrollTop
    const viewBottom = viewTop + el.clientHeight - ROW_H // header row
    if (top < viewTop)
      el.scrollTop = top
    else if (top + ROW_H > viewBottom)
      el.scrollTop = top + ROW_H - (el.clientHeight - ROW_H)
  }
  const col = byId.value.get(colId)
  if (col && !col.sticky) {
    const left = lefts.value.get(colId)!
    const w = width(colId)
    if (left - stickyWidth.value < el.scrollLeft)
      el.scrollLeft = left - stickyWidth.value
    else if (left + w > el.scrollLeft + el.clientWidth)
      el.scrollLeft = left + w - el.clientWidth
  }
}

function move(dRow: number, dCol: number) {
  const list = ws.visibleRows.value
  if (!list.length)
    return
  const cur = ws.activeCell.value
  const cols = editableIds.value
  let r = cur ? rowIndexOf(cur.rowId) : 0
  let c = cur ? cols.indexOf(cur.colId) : 0
  if (r < 0)
    r = 0
  if (c < 0)
    c = 0
  r = Math.max(0, Math.min(list.length - 1, r + dRow))
  c = Math.max(0, Math.min(cols.length - 1, c + dCol))
  activate(list[r]!.id, cols[c]!)
}

function startEdit(rowId: string, colId: string) {
  const col = byId.value.get(colId)
  const row = ws.rows.value.find(r => r.id === rowId)
  if (!col || col.kind !== 'data' || !row)
    return
  activate(rowId, colId)
  editing.value = { rowId, colId, value: row.raw[colId] ?? '' }
  nextTick(() => {
    editInput?.focus()
    editInput?.select()
  })
}

function commitEdit(then?: () => void) {
  const e = editing.value
  if (!e)
    return
  editing.value = null
  const row = ws.rows.value.find(r => r.id === e.rowId)
  if (row)
    ws.editCell(row, e.colId, e.value)
  scroller.value?.focus({ preventScroll: true })
  then?.()
}

function cancelEdit() {
  editing.value = null
  scroller.value?.focus({ preventScroll: true })
}

function onEditKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitEdit()
  }
  else if (e.key === 'Escape') {
    e.preventDefault()
    cancelEdit()
  }
  else if (e.key === 'Tab') {
    e.preventDefault()
    commitEdit(() => move(0, e.shiftKey ? -1 : 1))
  }
  e.stopPropagation()
}

function onGridKey(e: KeyboardEvent) {
  if (editing.value)
    return
  const page = Math.max(1, Math.floor((scroller.value?.clientHeight ?? 600) / ROW_H) - 2)
  const mod = e.metaKey || e.ctrlKey
  switch (e.key) {
    case 'ArrowDown': move(mod ? Infinity : 1, 0); break
    case 'ArrowUp': move(mod ? -Infinity : -1, 0); break
    case 'ArrowRight': move(0, mod ? Infinity : 1); break
    case 'ArrowLeft': move(0, mod ? -Infinity : -1); break
    case 'PageDown': move(page, 0); break
    case 'PageUp': move(-page, 0); break
    case 'Home': move(0, -Infinity); break
    case 'End': move(0, Infinity); break
    case 'Tab': move(0, e.shiftKey ? -1 : 1); break
    case 'Enter':
    case 'F2':
      if (ws.activeCell.value)
        startEdit(ws.activeCell.value.rowId, ws.activeCell.value.colId)
      else
        move(0, 0)
      break
    case 'c':
      if (!mod || !ws.activeCell.value)
        return
      copyActive()
      break
    default:
      return
  }
  e.preventDefault()
}

function copyActive() {
  const cell = ws.activeCell.value
  const row = cell && ws.rows.value.find(r => r.id === cell.rowId)
  if (row && cell)
    navigator.clipboard?.writeText(row.raw[cell.colId] ?? '')
}

function cellFrom(e: Event) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-col]')
  const rowEl = el?.closest<HTMLElement>('[data-row-id]')
  return el && rowEl ? { rowId: rowEl.dataset.rowId!, colId: el.dataset.col! } : null
}

function onMouseDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('input, button'))
    return
  const cell = cellFrom(e)
  if (!cell)
    return
  if (editing.value)
    commitEdit()
  const col = byId.value.get(cell.colId)
  if (col?.kind === 'data')
    activate(cell.rowId, cell.colId, false)
  else
    ws.selectedId.value = cell.rowId
}

function onDblClick(e: MouseEvent) {
  const cell = cellFrom(e)
  if (cell)
    startEdit(cell.rowId, cell.colId)
}

// Drop the active cell when its row is filtered out.
watch(ws.visibleRows, (list) => {
  const cur = ws.activeCell.value
  if (cur && !list.some(r => r.id === cur.rowId))
    ws.activeCell.value = null
})

// --- Error tooltip: one shared element instead of one per cell --------------------
const tip = ref<{ text: string, kind: string, x: number, y: number } | null>(null)
function onMouseOver(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]')
  if (!el) {
    tip.value = null
    return
  }
  const rect = el.getBoundingClientRect()
  tip.value = { text: el.dataset.tip!, kind: el.dataset.tipKind ?? 'error', x: rect.left, y: rect.bottom + 4 }
}

// --- Links ----------------------------------------------------------------------
const copied = ref<string | null>(null)
async function copyLink(row: Recipient) {
  if (!row.token)
    return
  await navigator.clipboard.writeText(ws.recapUrl(row.token))
  copied.value = row.id
  toast('Link copied', { description: ws.recapUrl(row.token) })
  setTimeout(() => {
    if (copied.value === row.id)
      copied.value = null
  }, 1500)
}

function warningFor(row: Recipient, colId: string) {
  return ws.template.value.warnings?.(row.data)[colId]
}

const when = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : ''
function actionsOf(row: Recipient) {
  return [
    // Highreel emailed it (M2.8), or the email didn't go out and why (M2.11).
    { key: 'emailed', icon: !row.emailed_at && row.email_error ? MailX : Mail, at: row.emailed_at ?? null, label: 'Emailed', error: row.emailed_at ? null : row.email_error ?? null },
    // Their WhatsApp chat was opened from Share (M2.9).
    { key: 'whatsapp', icon: MessageCircle, at: row.whatsapp_at ?? null, label: 'Sent on WhatsApp' },
    { key: 'saved', icon: Download, at: row.saved_at, label: 'Saved the image' },
    { key: 'shared', icon: Share2, at: row.shared_at, label: 'Shared' },
    { key: 'cta', icon: MousePointerClick, at: row.cta_clicked_at, label: 'Clicked your button' },
  ]
}

const typeIcon = { text: CaseSensitive, email: AtSign, phone: Phone, date: Calendar, int: Hash, decimal: Hash }
const numeric = (c?: TemplateColumn) => c?.type === 'int' || c?.type === 'decimal'

function cellClass(col: GridColumn, row: Recipient) {
  const active = ws.activeCell.value
  return [
    col.sticky ? 'sticky z-10' : '',
    col.id === lastStickyId.value ? 'border-r-foreground/15' : '',
    active && active.rowId === row.id && active.colId === col.id ? 'cell-active' : '',
  ]
}

defineExpose({ focus: () => scroller.value?.focus() })
</script>

<template>
  <div
    ref="scroller"
    class="grid-scroll scrollbar-none relative overflow-auto text-[13px] outline-none"
    tabindex="0"
    role="grid"
    :aria-rowcount="rows.length"
    @keydown="onGridKey"
    @mousedown="onMouseDown"
    @dblclick="onDblClick"
    @mouseover="onMouseOver"
    @mouseleave="tip = null"
    @scroll.passive="tip = null"
  >
    <div :style="{ width: `${totalWidth}px`, minWidth: '100%' }">
      <!-- Header -->
      <div class="sticky top-0 z-20 flex h-8 border-b bg-subtle" role="row">
        <div
          v-for="col in gridColumns"
          :key="col.id"
          class="relative flex h-full shrink-0 items-center gap-1.5 border-r bg-subtle px-2 text-[12px] font-medium text-muted-foreground"
          :class="[col.sticky ? 'sticky z-10' : '', col.id === lastStickyId ? 'border-r-foreground/15' : '', numeric(col.def) ? 'justify-end' : '']"
          :style="{ width: `${width(col.id)}px`, left: col.sticky ? `${lefts.get(col.id)}px` : undefined }"
          role="columnheader"
        >
          <template v-if="col.kind === 'row'">
            <span class="ml-auto font-mono">#</span>
          </template>
          <template v-else-if="col.kind === 'data' && col.def">
            <component :is="typeIcon[col.def.type]" class="size-3.5 shrink-0 opacity-70" />
            <span class="truncate font-mono text-foreground/80" :title="`${col.def.label && col.def.label !== col.def.key ? `${col.def.label} → ` : ''}${col.def.key} · ${col.def.rule}`">{{ col.def.key }}</span>
            <span v-if="col.def.required" class="font-mono text-destructive/70" title="Required">*</span>
            <!-- The recap's own columns (M2.7): change type, remove. -->
            <ColumnMenu v-if="col.def.label !== undefined && !ws.isBusiness.value" :column="col.def" />
          </template>
          <template v-else-if="col.kind === 'link'">
            <Link2 class="size-3.5 shrink-0 opacity-70" />
            <span class="font-mono text-foreground/80">link</span>
          </template>
          <template v-else-if="col.kind === 'views'">
            <Eye class="size-3.5 shrink-0 opacity-70" />
            <span class="font-mono text-foreground/80">viewed</span>
          </template>
          <template v-else-if="col.kind === 'actions'">
            <Activity class="size-3.5 shrink-0 opacity-70" />
            <span class="font-mono text-foreground/80" title="Emailed · WhatsApp · Saved · Shared · Clicked">did</span>
          </template>
          <div
            v-if="col.kind === 'data' || col.kind === 'link'"
            class="col-resizer"
            :class="{ 'is-resizing': table.getColumn(col.id)?.getIsResizing() }"
            @mousedown.stop="headers.find(h => h.column.id === col.id)?.getResizeHandler()($event)"
            @touchstart.stop="headers.find(h => h.column.id === col.id)?.getResizeHandler()($event)"
            @dblclick.stop="table.getColumn(col.id)?.resetSize()"
          />
        </div>
      </div>

      <!-- Body -->
      <div class="relative" :style="{ height: `${totalHeight}px` }">
        <div
          v-for="vr in virtualRows"
          :key="vr.key as string"
          class="group/row absolute left-0 top-0 flex w-full"
          :class="ws.selectedId.value === rows[vr.index]?.id ? 'is-selected' : ''"
          :style="{ height: `${ROW_H}px`, transform: `translateY(${vr.start}px)` }"
          :data-row-id="rows[vr.index]?.id"
          role="row"
        >
          <template v-if="rows[vr.index]">
            <div
              v-for="col in gridColumns"
              :key="col.id"
              class="grid-cell relative h-full shrink-0 border-r border-b"
              :class="cellClass(col, rows[vr.index]!.original)"
              :style="{ width: `${width(col.id)}px`, left: col.sticky ? `${lefts.get(col.id)}px` : undefined }"
              :data-col="col.id"
              role="gridcell"
            >
              <div v-if="col.kind === 'row'" class="flex h-full items-center justify-end px-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                {{ rows[vr.index]!.original.row_index + 1 }}
              </div>
              <div v-else-if="col.kind === 'status'" class="flex h-full items-center justify-center">
                <StatusDot :status="ws.statusOf(rows[vr.index]!.original)" />
              </div>
              <template v-else-if="col.kind === 'data' && col.def">
                <input
                  v-if="editing && editing.rowId === rows[vr.index]!.id && editing.colId === col.id"
                  :ref="setEditInput"
                  v-model="editing.value"
                  class="absolute inset-0 z-10 h-full w-full bg-background px-2 text-[13px] outline-none ring-2 ring-inset ring-primary"
                  :class="numeric(col.def) ? 'text-right font-mono text-[12px] tabular-nums' : ''"
                  :aria-label="`Edit ${col.def.key}, row ${rows[vr.index]!.original.row_index + 1}`"
                  spellcheck="false"
                  autocomplete="off"
                  @keydown="onEditKey"
                  @blur="commitEdit()"
                >
                <GridCell
                  v-else
                  :value="rows[vr.index]!.original.raw[col.id] ?? ''"
                  :column="col.def"
                  :error="rows[vr.index]!.original.errors[col.id]"
                  :warning="warningFor(rows[vr.index]!.original, col.id)"
                />
              </template>
              <div v-else-if="col.kind === 'link'" class="flex h-full items-center gap-1 pr-1 pl-2">
                <template v-if="rows[vr.index]!.original.token">
                  <a
                    class="truncate font-mono text-[12px] text-foreground/80 hover:underline"
                    :href="`/r/${rows[vr.index]!.original.token}`"
                    target="_blank"
                    rel="noopener"
                  >/r/{{ rows[vr.index]!.original.token }}</a>
                  <button
                    type="button"
                    class="ml-auto grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    :aria-label="`Copy link for row ${rows[vr.index]!.original.row_index + 1}`"
                    @click="copyLink(rows[vr.index]!.original)"
                  >
                    <Check v-if="copied === rows[vr.index]!.id" class="size-3.5" />
                    <Copy v-else class="size-3.5" />
                  </button>
                </template>
                <span v-else class="text-[12px] text-muted-foreground">—</span>
              </div>
              <div
                v-else-if="col.kind === 'views'"
                class="flex h-full items-center justify-end px-2 font-mono text-[12px] tabular-nums"
                :data-tip="rows[vr.index]!.original.first_viewed_at ? `First viewed ${when(rows[vr.index]!.original.first_viewed_at)}` : undefined"
                data-tip-kind="info"
              >
                <span v-if="rows[vr.index]!.original.view_count">{{ rows[vr.index]!.original.view_count }}</span>
                <span v-else class="text-muted-foreground">{{ rows[vr.index]!.original.token ? '0' : '—' }}</span>
              </div>
              <div v-else-if="col.kind === 'actions'" class="flex h-full items-center gap-1.5 px-2">
                <span
                  v-for="a in actionsOf(rows[vr.index]!.original)"
                  :key="a.key"
                  class="grid size-5 place-items-center rounded-full"
                  :class="a.at ? 'bg-primary text-primary-foreground' : 'error' in a && a.error ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground/40'"
                  :data-tip="a.at ? `${a.label} · ${when(a.at)}` : 'error' in a && a.error ? `Not emailed: ${a.error}` : `Not ${a.label.toLowerCase()} yet`"
                  data-tip-kind="info"
                  role="img"
                  :aria-label="a.at ? a.label : 'error' in a && a.error ? `Not emailed: ${a.error}` : `Not ${a.label.toLowerCase()}`"
                  :data-mark="a.key"
                >
                  <component :is="a.icon" class="size-3" />
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div
      v-if="tip"
      class="pointer-events-none fixed z-50 max-w-64 rounded-lg px-2.5 py-1 text-[12px] font-medium shadow-md"
      :class="tip.kind === 'error' ? 'bg-destructive text-white' : tip.kind === 'warning' ? 'bg-amber-500 text-black' : 'bg-foreground text-background'"
      :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
      role="tooltip"
    >
      {{ tip.text }}
    </div>
  </div>
</template>

<style scoped>
.grid-cell {
  background: var(--background);
}
.group\/row:hover .grid-cell {
  background: var(--subtle);
}
.is-selected .grid-cell {
  background: color-mix(in oklab, var(--primary) 7%, var(--background));
}
.cell-active::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 2px var(--primary);
  pointer-events: none;
  z-index: 2;
}
.col-resizer {
  position: absolute;
  top: 0;
  right: -3px;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 3;
  touch-action: none;
}
.col-resizer:hover,
.col-resizer.is-resizing {
  background: color-mix(in oklab, var(--primary) 45%, transparent);
}
</style>
