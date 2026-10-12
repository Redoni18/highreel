<script setup lang="ts">
// A slide's line in Design (SPEC M2.8): the input, then its placeholders as
// chips that drop "{first_name}" at the cursor, and a menu with the recap's
// other columns (shadcn Buttons and a DropdownMenu, M2.10). Blank means the
// default, so the first chip on a blank line starts from the default wording.
import { ChevronDown, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const props = withDefaults(defineProps<{
  id: string
  /** The default wording, shown while the line is blank */
  placeholder: string
  tokens: { key: string, label?: string }[]
  /** Other columns, offered in a menu after the chips */
  more?: { key: string, label: string }[]
  maxlength?: number
  multiline?: boolean
}>(), { more: () => [], maxlength: 120, multiline: false })
const model = defineModel<string | undefined>()

const wrap = ref<HTMLElement | null>(null)
/** Where the cursor was when the field lost focus (the column menu takes it). */
let caret: [number, number] | null = null
function remember(e: FocusEvent) {
  const el = e.target as HTMLInputElement
  if (el.matches('input, textarea'))
    caret = [el.selectionStart ?? 0, el.selectionEnd ?? 0]
}
function field(): HTMLInputElement | HTMLTextAreaElement | null {
  return wrap.value?.querySelector('input, textarea') ?? null
}

function insert(key: string) {
  const el = field()
  const token = `{${key}}`
  const current = model.value ?? ''
  if (!current.trim()) {
    model.value = `${props.placeholder.trimEnd()} ${token}`.slice(0, props.maxlength)
    nextTick(() => {
      const f = field()
      f?.focus()
      f?.setSelectionRange(f.value.length, f.value.length)
    })
    return
  }
  const focused = el && document.activeElement === el
  const at = Math.min(current.length, focused ? el.selectionStart ?? current.length : caret?.[0] ?? current.length)
  const until = Math.max(at, Math.min(current.length, focused ? el.selectionEnd ?? at : caret?.[1] ?? at))
  const before = current.slice(0, at)
  const pad = before && !/\s$/.test(before) ? ' ' : ''
  const next = `${before}${pad}${token}${current.slice(until)}`.slice(0, props.maxlength)
  model.value = next
  nextTick(() => {
    const f = field()
    const pos = before.length + pad.length + token.length
    f?.focus()
    f?.setSelectionRange(pos, pos)
  })
}

// Built here: a literal "}}" inside a template {{ }} would end it early.
const chip = (t: { key: string, label?: string }) => t.label ?? `{${t.key}}`
</script>

<template>
  <div ref="wrap" class="flex flex-col gap-2" @focusout="remember">
    <Textarea v-if="multiline" :id="id" v-model="model" :maxlength="maxlength" rows="3" class="min-h-0" :placeholder="placeholder" />
    <Input v-else :id="id" v-model="model" :maxlength="maxlength" :placeholder="placeholder" />
    <div class="flex flex-wrap items-center gap-1" :data-tokens="id">
      <Button
        v-for="t in tokens"
        :key="t.key"
        type="button"
        variant="secondary"
        size="xs"
        class="token"
        :title="`Insert {${t.key}}`"
        @mousedown.prevent
        @click="insert(t.key)"
      >
        {{ chip(t) }}
      </Button>
      <DropdownMenu v-if="more.length">
        <DropdownMenuTrigger as-child>
          <Button type="button" variant="ghost" size="xs" class="text-muted-foreground" data-testid="more-columns">Another column <ChevronDown /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="max-h-72 overflow-y-auto">
          <DropdownMenuLabel class="text-[12px] font-normal text-muted-foreground">Insert a column</DropdownMenuLabel>
          <DropdownMenuItem v-for="c in more" :key="c.key" @select="insert(c.key)">{{ c.label }}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button v-if="model?.trim()" type="button" variant="ghost" size="xs" class="ml-auto text-muted-foreground" @click="model = ''">
        <RotateCcw /> Default
      </Button>
    </div>
  </div>
</template>

<style scoped>
.token {
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 400;
}
.token:hover { background: color-mix(in oklab, var(--primary) 12%, var(--muted)); color: var(--primary); }
</style>
