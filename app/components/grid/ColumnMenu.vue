<script setup lang="ts">
// The menu on one of the recap's own columns in the Sheet (SPEC M2.7):
// change its type (every row is checked again; if some cells won't fit, say
// how many first) or remove it, with its slides. Data, so it lives here and
// not in Design.
import { ChevronDown, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { AcceptableValue } from 'reka-ui'
import type { CustomColumn, TemplateColumn } from '#shared/templates/types'
import { ownColumnDef } from '#shared/templates/own'
import { hasErrors, validateCell } from '#shared/utils/validate'

const props = defineProps<{ column: TemplateColumn }>()
const ws = useWorkspace()

type OwnType = CustomColumn['type']
const TYPES: Array<{ value: OwnType, label: string }> = [
  { value: 'int', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
]
const NAMES: Record<OwnType, string> = { int: 'a number', decimal: 'a decimal', text: 'text', date: 'a date' }
const key = computed(() => props.column.key)
const fmt = (x: number) => x.toLocaleString('en-US')

/** Filled cells that won't fit the new type. */
function misfits(type: OwnType): number {
  const def = ownColumnDef({ key: key.value, label: props.column.label ?? key.value, type })
  return ws.rows.value.filter((r) => {
    const v = r.raw[key.value] ?? ''
    return v.trim() !== '' && !!validateCell(def, v).error
  }).length
}
const slides = computed(() => (ws.campaign.value?.settings.slides ?? []).filter(s => s.column === key.value || s.columns?.includes(key.value)).length)

// What the confirm dialog asks about. It stays set while the dialog closes,
// since ConfirmDialog closes itself before it emits "confirm".
const pending = ref<null | { type: OwnType, misfits: number } | { remove: true }>(null)
const confirmOpen = ref(false)
function ask(p: NonNullable<typeof pending.value>) {
  pending.value = p
  confirmOpen.value = true
}
const confirmText = computed(() => {
  const p = pending.value
  if (!p)
    return { title: '', description: '', label: '' }
  if ('remove' in p) {
    const what = slides.value ? `Its ${slides.value === 1 ? 'slide goes' : `${slides.value} slides go`} too. ` : ''
    return { title: `Remove ${key.value}?`, description: `${what}Its cells leave this highlight reel; upload your sheet again to bring the column back.`, label: 'Remove column' }
  }
  return {
    title: `Make ${key.value} ${NAMES[p.type]}?`,
    description: `${fmt(p.misfits)} ${p.misfits === 1 ? 'row has a cell' : 'rows have cells'} that won't fit and will need fixing before ${p.misfits === 1 ? 'it goes' : 'they go'} out.`,
    label: 'Change type',
  }
})

async function pick(value: AcceptableValue) {
  const type = value as OwnType
  if (type === props.column.type)
    return
  const n = misfits(type)
  if (n)
    ask({ type, misfits: n })
  else
    await apply({ type })
}

async function apply(change: { type: OwnType } | { remove: true }) {
  const name = key.value
  if (!await ws.changeColumn(name, change))
    return
  if ('remove' in change) {
    toast(`Removed ${name}`)
    return
  }
  const fix = ws.rows.value.filter(r => hasErrors(r.errors) && r.errors[name]).length
  toast(`${name} is now ${NAMES[change.type]}`, { description: fix ? `${fmt(fix)} ${fix === 1 ? 'row needs' : 'rows need'} fixing` : undefined })
}

function confirm() {
  const p = pending.value
  pending.value = null
  if (p)
    apply('remove' in p ? { remove: true } : { type: p.type })
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button type="button" class="col-menu" :aria-label="`Column ${column.key}`" :data-column-menu="column.key">
        <ChevronDown class="size-3" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-48 text-[13px]">
      <DropdownMenuLabel class="text-[11px] font-medium text-muted-foreground">Type</DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="column.type" @update:model-value="pick">
        <DropdownMenuRadioItem v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" @select="ask({ remove: true })">
        <Trash2 /> Remove column
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <ConfirmDialog v-model:open="confirmOpen" :title="confirmText.title" :description="confirmText.description" :confirm-label="confirmText.label" @confirm="confirm" />
</template>

<style scoped>
.col-menu {
  display: grid;
  flex: none;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 6px;
  color: var(--muted-foreground);
}
.col-menu:hover,
.col-menu[data-state='open'] {
  background: var(--muted);
  color: var(--foreground);
}
</style>
