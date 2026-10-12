<script setup lang="ts">
// Match the sheet's headers to the template's fields (SPEC M2f), and pick
// which of its other columns become the recap's own, each with a slide
// (M2.7). Opens when the headers don't already fit or the sheet brings new
// columns; suggestions come from names, synonyms and the cells' contents.
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ColumnMapping, SheetExtra } from '#shared/utils/mapping'
import { missingRequired } from '#shared/utils/mapping'

const ws = useWorkspace()
const pending = computed(() => ws.pendingMapping.value)
const mapping = ref<ColumnMapping>({})
const extras = ref<SheetExtra[]>([])
watch(pending, (p) => {
  if (p) {
    mapping.value = { ...p.mapping }
    extras.value = p.extras.map(e => ({ ...e }))
  }
}, { immediate: true })

const open = computed({
  get: () => !!pending.value,
  set: (v) => {
    if (!v)
      ws.pendingMapping.value = null
  },
})
const fields = computed(() => ws.baseTemplate.value.columns)
const missing = computed(() => missingRequired(ws.baseTemplate.value, mapping.value))
// A header matched to a field isn't offered as an own column.
const others = computed(() => {
  const used = new Set(Object.values(mapping.value).filter(Boolean))
  return extras.value.filter(e => !used.has(e.header))
})
const picked = computed(() => others.value.filter(e => e.keep).length)
const sample = (header: string | null) => (header ? pending.value?.sheet.rows.find(r => r[header])?.[header] ?? '' : '')
const fmt = (x: number) => x.toLocaleString('en-US')
const typeLabel = { int: 'Number', decimal: 'Decimal', text: 'Text', date: 'Date' }
// Select items can't have an empty value: "no column" has its own.
const NONE = '__none'
function setMapping(key: string, v: unknown) {
  mapping.value[key] = typeof v === 'string' && v !== NONE ? v : null
}
function setAll(keep: boolean) {
  for (const e of others.value)
    e.keep = keep
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Match your columns</DialogTitle>
        <DialogDescription>
          <span class="font-mono">{{ pending?.sheet.name }}</span> has {{ fmt(pending?.sheet.rows.length ?? 0) }} rows. Pick which of its columns fills each field. We guessed where we could.
        </DialogDescription>
      </DialogHeader>

      <div class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
        <div class="rounded-2xl border">
          <table class="w-full table-fixed text-left text-[12px]" data-fields>
            <thead class="sticky top-0 border-b bg-subtle text-muted-foreground">
              <tr>
                <th class="w-[34%] px-2 py-1.5 font-medium">Field</th>
                <th class="w-[33%] px-2 py-1.5 font-medium">Your column</th>
                <th class="px-2 py-1.5 font-medium">First value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="col in fields" :key="col.key" class="border-b last:border-0">
                <td class="truncate px-2 py-1 font-mono">
                  {{ col.key }}<span v-if="col.required" class="text-destructive/70"> *</span>
                </td>
                <td class="px-2 py-1">
                  <Select :model-value="mapping[col.key] ?? NONE" @update:model-value="v => setMapping(col.key, v)">
                    <SelectTrigger
                      size="sm"
                      class="h-7 w-full bg-background px-2 text-[12px]"
                      :aria-invalid="col.required && !mapping[col.key] ? true : undefined"
                      :aria-label="`Column for ${col.key}`"
                      :data-map="col.key"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" class="max-h-64">
                      <SelectItem :value="NONE" class="text-muted-foreground">{{ col.required ? 'Pick a column' : 'Leave empty' }}</SelectItem>
                      <SelectSeparator />
                      <SelectItem v-for="h in pending?.sheet.headers.filter(Boolean)" :key="h" :value="h">{{ h }}</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td class="truncate px-2 py-1 text-muted-foreground">{{ sample(mapping[col.key] ?? null) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <section v-if="others.length" class="flex flex-col gap-2" aria-labelledby="map-own">
          <div class="flex items-end justify-between gap-3">
            <div>
              <h3 id="map-own" class="text-[14px] font-semibold">Your other columns</h3>
              <p class="text-[12px] text-muted-foreground">Each one you add becomes a slide. You can change how it looks, or hide it, in Design.</p>
            </div>
            <div class="flex shrink-0 gap-1 text-[12px]">
              <Button type="button" variant="ghost" size="xs" @click="setAll(true)">All</Button>
              <Button type="button" variant="ghost" size="xs" @click="setAll(false)">None</Button>
            </div>
          </div>
          <div class="rounded-2xl border">
            <table class="w-full table-fixed text-left text-[12px]" data-own>
              <thead class="border-b bg-subtle text-muted-foreground">
                <tr>
                  <th class="w-[34%] px-2 py-1.5 font-medium">Your column</th>
                  <th class="w-[16%] px-2 py-1.5 font-medium">Type</th>
                  <th class="px-2 py-1.5 font-medium">First value</th>
                  <th class="w-16 px-2 py-1.5 text-right font-medium">Add</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in others" :key="e.header" class="border-b last:border-0" :data-own-column="e.key">
                  <td class="truncate px-2 py-1">
                    <label :for="`own-${e.key}`" class="font-medium">{{ e.header }}</label>
                    <span v-if="e.private" class="ml-1.5 text-muted-foreground" title="Looks like contact details or an id: left out unless you add it">· private?</span>
                  </td>
                  <td class="px-2 py-1 text-muted-foreground" data-type>{{ typeLabel[e.type] }}</td>
                  <td class="truncate px-2 py-1 text-muted-foreground">{{ e.sample }}</td>
                  <td class="px-2 py-1 text-right">
                    <Checkbox :id="`own-${e.key}`" v-model="e.keep" :aria-label="`Add ${e.header} as a slide`" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <DialogFooter class="items-center">
        <p v-if="missing.length" class="mr-auto text-[12px] text-destructive">Still needed: {{ missing.join(', ') }}</p>
        <p v-else-if="others.length" class="mr-auto text-[12px] text-muted-foreground">{{ picked }} of {{ others.length }} other {{ others.length === 1 ? 'column' : 'columns' }} added</p>
        <Button variant="outline" size="sm" @click="open = false">Cancel</Button>
        <Button size="sm" :disabled="missing.length > 0" @click="ws.confirmMapping(mapping, extras)">Import {{ fmt(pending?.sheet.rows.length ?? 0) }} rows</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
