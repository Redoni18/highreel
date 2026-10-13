<script setup lang="ts">
// Design, step two of a recap (SPEC M2.6, an editor since M2.8): how it looks
// and what it says. Three panes: the rail lists the look and the slides
// (drag ⠿ to reorder, the eye hides, + adds), the inspector edits the one
// that's selected, and the phone jumps to it. Since M2.7 the slide list is
// the recap's own: each slide picks its animation from the scene library
// (with options and a show rule), and "Add a slide" shows any column, a
// "top X%" by a number, a list, or a new column. Edits are a draft
// (ws.draft, also played by the Sheet's preview) until Save; photos save on
// their own. Colour and logo belong to Your brand. The template is picked
// once, in New recap. Since M2.9 the slides that move go by their place
// ("Slide 3") with their line underneath, not by a name the wording would
// have to match.
import { ALargeSmall, ArrowDown, ArrowRight, ArrowUp, Award, Bubbles, CalendarCheck, CalendarDays, ChartBarDecreasing, Columns3, Dices, Eye, EyeOff, Flashlight, GitCommitVertical, GlassWater, GripVertical, Hash, Image, Keyboard, Layers, Lightbulb, Link2, ListChecks, ListOrdered, Mountain, MousePointerClick, Percent, PlaneTakeoff, Plus, Quote, Receipt, Shuffle, Sparkles, Stamp, Sticker, Tally5, Trash2, Trophy, Type, UserX, Gauge as GaugeIcon } from '@lucide/vue'
import type { Component } from 'vue'
import { toast } from 'vue-sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type PhoneStage from '~/components/workspace/PhoneStage.vue'
import type { CampaignSettings } from '#shared/types/recap'
import type { CustomColumn, SceneKind, SlideDef, SlideSetting, TemplateColumn, TokenShape } from '#shared/templates/types'
import { addedKey, columnsWithOwn, DEFAULT_TOP, isNumeric, MAX_LIST, MAX_OWN_COLUMNS, nextListKey, ownKeyOk, RESERVED_KEYS, SCENES, scenesFor, slideable, slideEntries, type SlideEntry, TOKEN_SHAPES } from '#shared/templates/own'
import { ownKeyFor } from '#shared/utils/mapping'
import { sceneOf } from '#shared/utils/scenes'
import { buildSlides, formatNumber } from '#shared/utils/slides'
import { readableOn } from '#shared/utils/color'

const ws = useWorkspace()
const template = computed(() => ws.template.value)
const base = computed(() => ws.baseTemplate.value)
const business = computed(() => ws.business.value!)

function saved(): CampaignSettings {
  const s = ws.campaign.value!.settings
  return {
    ...s,
    copy: { ...s.copy },
    columns: (s.columns ?? []).map(c => ({ ...c })),
    slides: s.slides ? s.slides.map(x => ({ ...x })) : null,
  }
}
// The draft starts as the saved settings, and again whenever it's cleared
// (Save, Discard, or switching to another recap while this tab is open).
watch(() => ws.draft.value, (v) => {
  if (!v && ws.campaign.value)
    ws.draft.value = saved()
}, { immediate: true, flush: 'sync' })
const d = computed(() => ws.draft.value!)

const themes = [
  { value: 'stories' as const, label: 'Stories' },
  { value: 'paper' as const, label: 'Paper' },
]
const themeBody = (t: string) => (t === 'paper' ? '#F4F1EA' : business.value.accent_color)

// --- The recap's slide list (M2.7) ------------------------------------------------
const entries = computed(() => slideEntries(base.value, d.value))
const columns = computed(() => columnsWithOwn(base.value, d.value))
const colName = (c: TemplateColumn) => c.label ?? c.key

/** Write the list as it plays (all slides, in order), the first time it's edited. */
function settled(): SlideSetting[] {
  const current = d.value.slides ?? []
  d.value.slides = entries.value.map(e => current.find(s => s.key === e.setting.key) ?? { ...e.setting })
  return d.value.slides
}
function settingFor(key: string): SlideSetting | undefined {
  return settled().find(s => s.key === key)
}
/** Set options on a slide; undefined or false removes one (the stored list stays minimal). */
function setOption(key: string, patch: Partial<SlideSetting>) {
  const s = settingFor(key) as Record<string, unknown> | undefined
  if (!s)
    return
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === false)
      delete s[k]
    else
      s[k] = v
  }
}
function reorder(from: number, to: number) {
  const list = settled()
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to)
    return
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved!)
  announce(`Moved to slide ${to + 2}`)
}
function move(key: string, delta: -1 | 1) {
  const at = entries.value.findIndex(e => e.def.key === key)
  reorder(at, at + delta)
  nextTick(() => jump(key))
}
/** ↑/↓ on a row's handle; the handle keeps focus as its row moves. */
function moveByKey(key: string, delta: -1 | 1) {
  move(key, delta)
  nextTick(() => rail.value?.querySelector<HTMLElement>(`[data-sort-key="${key}"] .grip`)?.focus())
}
function toggleHidden(key: string) {
  const e = entries.value.find(x => x.def.key === key)
  if (e)
    setOption(key, { hidden: !e.hidden })
}
function remove(key: string) {
  const at = entries.value.findIndex(e => e.def.key === key)
  d.value.slides = settled().filter(s => s.key !== key)
  delete d.value.copy[key]
  const next = entries.value[Math.min(at, entries.value.length - 1)]
  select(next?.def.key ?? 'cover')
}

const live = ref('')
function announce(text: string) {
  live.value = text
}

// Drag to reorder (the rail's ⠿ handles).
const rail = ref<HTMLElement | null>(null)
const sortList = ref<HTMLElement | null>(null)
const sort = useSortable(sortList, () => entries.value.map(e => e.def.key), (from, to) => {
  const key = entries.value[from]?.def.key
  reorder(from, to)
  if (key)
    nextTick(() => jump(key))
})

const SCENE_ICONS: Record<SceneKind, Component> = {
  count: Hash, days: CalendarDays, streak: Link2, tally: Tally5, fill: GlassWater, slots: Dices, bignumber: ALargeSmall, bubbles: Bubbles, gauge: GaugeIcon, climb: Mountain,
  word: Type, badge: Award, sticker: Sticker, typewriter: Keyboard, flap: PlaneTakeoff, neon: Lightbulb, scatter: Shuffle, spotlight: Flashlight, date: CalendarCheck, postmark: Stamp,
  rank: Percent, podium: Trophy, leaderboard: ChartBarDecreasing,
  timeline: GitCommitVertical, receipt: Receipt, cards: Layers, checklist: ListChecks,
}
const TOKEN_LABELS: Record<TokenShape, string> = { shapes: '■ ● Shapes', dots: '● Dots', hearts: '♥ Hearts', stars: '★ Stars' }
const tokenOptions = TOKEN_SHAPES.map(t => ({ value: t, label: TOKEN_LABELS[t] }))
const spanOptions = [{ value: 'year' as const, label: 'A year' }, { value: 'visit' as const, label: 'A short visit' }]
const typeOptions = [{ value: 'int', label: 'Number' }, { value: 'decimal', label: 'Decimal' }, { value: 'text', label: 'Text' }, { value: 'date', label: 'Date' }]
function pickScene(key: string, scene: unknown) {
  if (typeof scene === 'string' && scene) {
    setOption(key, { scene: scene as SceneKind })
    jump(key)
  }
}

function ruleOf(e: SlideEntry): string {
  const s = e.def
  if (s.list)
    return 'Shows when any of its columns is filled in; each one is a line with its name.'
  if (s.top || s.scene === 'rank')
    return `Shows for people in the top ${s.max ?? DEFAULT_TOP}%.${s.rankBy ? ' Updates when you publish.' : ''}`
  if (s.needsLabel)
    return 'Shows when the count label is filled in and the number is 1 or more.'
  if (s.max !== undefined)
    return `Shows when the number is ${s.max} or less.`
  if (s.min !== undefined && s.min > 1)
    return `Shows when the number is ${s.min} or more.`
  if (s.min === 1)
    return 'Shows when the number is 1 or more.'
  if (s.kind === 'date')
    return 'Shows when the cell has a date.'
  if (s.kind === 'text')
    return 'Shows when the cell is filled in.'
  return 'Shows when the cell has a number.'
}
const showsFrom = (s: SlideDef) => s.kind === 'number' && !s.list && !s.top && s.scene !== 'rank'
const isTop = (s: SlideDef) => !!s.top || s.scene === 'rank'

// --- Add a slide ------------------------------------------------------------------
const addValue = ref('')
const addTop = ref('')
// Columns a slide already shows on its own (a list or a top % doesn't count).
const used = computed(() => new Set(entries.value.flatMap(e => (e.def.rankBy || e.def.list ? [] : [e.def.column]))))
const addable = computed(() => columns.value.filter(c => slideable(c, base.value) && !used.value.has(c.key)))
const rankable = computed(() => columns.value.filter(c => isNumeric(c.type) && slideable(c, base.value) && !entries.value.some(e => e.def.key === addedKey(c.key, 'top'))))
function addSlide(column: string, show: 'value' | 'top') {
  const key = addedKey(column, show)
  const list = settled()
  const had = list.find(s => s.key === key)
  if (had)
    delete had.hidden
  else
    list.push({ key, column, show })
  nextTick(() => select(key))
}
function addPicked(show: 'value' | 'top') {
  const pick = show === 'value' ? addValue : addTop
  if (pick.value)
    addSlide(pick.value, show)
  pick.value = ''
}

// --- Lists: several columns down one timeline (M2.7) ------------------------------
const listable = computed(() => columns.value.filter(c => slideable(c, base.value)))
function addList() {
  const pool = listable.value
  // Words and dates read best as a list; numbers fill in after.
  const cols = [...pool.filter(c => !isNumeric(c.type)), ...pool.filter(c => isNumeric(c.type))].slice(0, 3).map(c => c.key)
  const list = settled()
  const key = nextListKey(list)
  list.push({ key, show: 'list', columns: cols })
  nextTick(() => select(key))
}
const listColumns = (e: SlideEntry) => e.def.list ?? []
const listOptions = (e: SlideEntry) => listable.value.filter(c => !listColumns(e).includes(c.key))
function addToList(key: string, column: string) {
  const e = entries.value.find(x => x.def.key === key)
  if (e && column)
    setOption(key, { columns: [...listColumns(e), column].slice(0, MAX_LIST) })
}
function dropFromList(key: string, column: string) {
  const e = entries.value.find(x => x.def.key === key)
  if (e && listColumns(e).length > 1)
    setOption(key, { columns: listColumns(e).filter(c => c !== column) })
}
const colLabel = (k: string) => columns.value.find(c => c.key === k)?.label ?? k

const newName = ref('')
const newType = ref<CustomColumn['type']>('int')
const ownCount = computed(() => d.value.columns?.length ?? 0)
function addColumn() {
  const name = newName.value.trim()
  if (!name)
    return
  if (ownCount.value >= MAX_OWN_COLUMNS) {
    toast.error(`Up to ${MAX_OWN_COLUMNS} of your own columns`)
    return
  }
  const taken = new Set([...columns.value.map(c => c.key), ...RESERVED_KEYS])
  const key = ownKeyFor(name, taken)
  if (!ownKeyOk(key, base.value)) {
    toast.error('Try another name for the column')
    return
  }
  d.value.columns = [...(d.value.columns ?? []), { key, label: name.slice(0, 60), type: newType.value }]
  addSlide(key, 'value')
  newName.value = ''
}

// --- The rail: the cover, the slides that move, add, and the fixed end -------------
type Kind = 'cover' | 'slide' | 'add' | 'photos' | 'note' | 'button'
interface Item { key: string, title: string, kind: Kind, icon: Component, entry?: SlideEntry }
const noteLabel = computed(() => template.value.noteLabel ?? (template.value.key === 'visit' ? 'Note from the team' : 'Founder note'))
const cover: Item = { key: 'cover', title: 'Cover', kind: 'cover', icon: Sparkles }
/** The column a slide shows, for the inspector's header (a list shows several). */
const columnOf = (it: Item) => it.entry && !it.entry.def.list ? it.entry.def.column : null
const add: Item = { key: 'add', title: 'Add a slide', kind: 'add', icon: Plus }
// The cover is slide 1; the ones that move are numbered by their place in the list.
const movable = computed<Item[]>(() => entries.value.map((e, i) => ({ key: e.def.key, title: `Slide ${i + 2}`, kind: 'slide' as const, entry: e, icon: SCENE_ICONS[sceneOf(e.def)] ?? Hash })))
const tail = computed<Item[]>(() => [
  { key: 'photos', title: 'Group photos', kind: 'photos', icon: Image },
  { key: 'note', title: ws.isBusiness.value ? 'Thank-you note' : noteLabel.value, kind: 'note', icon: Quote },
  { key: 'share', title: 'Last slide', kind: 'button', icon: MousePointerClick },
])
const items = computed<Item[]>(() => [cover, ...movable.value, ...(ws.isBusiness.value ? [] : [add]), ...tail.value])
const isItemsSlide = (s?: SlideDef) => !!s && !!template.value.itemsLabel && template.value.itemsLabel.column === s.column

// --- The phone follows the selected item ------------------------------------------
const stage = ref<InstanceType<typeof PhoneStage> | null>(null)
const player = computed(() => stage.value?.player ?? null)
const payload = computed(() => ws.previewPayload.value)
const person = computed(() => payload.value?.recipient.first_name || 'this person')
const active = ref('cover')
const current = computed(() => items.value.find(i => i.key === active.value) ?? cover)
function indexOf(key: string): number {
  const keys: string[] = player.value?.keys ?? []
  return key === 'photos' ? keys.findIndex(k => k.startsWith('photo-')) : keys.indexOf(key)
}
function jump(key: string) {
  const i = indexOf(key)
  if (player.value && i >= 0) {
    player.value.playing = false
    player.value.go(i)
  }
}
function select(key: string) {
  active.value = key
  jump(key)
}
// A slide that went away (removed, or its column taken off in the Sheet) leaves the cover selected.
watch(items, list => list.some(i => i.key === active.value) || (active.value = 'cover'))
const shown = (key: string) => !player.value || indexOf(key) >= 0

// Each slide's line as the previewed person reads it ("Longest streak: 5 days in a row."),
// or as written when they don't get that slide.
const built = computed(() => new Map(payload.value ? buildSlides(ws.previewTemplate.value, payload.value).map(x => [x.key as string, x]) : []))
function lineOf(it: Item): string {
  if (it.kind === 'photos')
    return ws.photos.value.length ? `${ws.photos.value.length} ${ws.photos.value.length === 1 ? 'photo' : 'photos'}, a slide each` : 'None yet'
  if (it.kind === 'note')
    return ws.isBusiness.value ? 'Written in Content' : d.value.founder_note.trim() || 'No note'
  if (it.kind === 'button')
    return d.value.cta_label.trim() ? `Share card, then “${d.value.cta_label.trim()}”` : 'Share card, no button'
  const x = built.value.get(it.key)
  if (x) {
    if (it.kind === 'cover' && x.title)
      return x.title
    if (x.items?.length)
      return x.items.map(m => (m.label ? `${m.label}: ${m.text}` : m.text)).join(' · ')
    const big = x.value !== undefined ? `${x.prefix ?? ''}${formatNumber(x.value)}${x.suffix ?? ''}` : (x.text ?? '')
    // The parts come trimmed: put the spaces back, but none before punctuation ("days.", "row!").
    const line = [x.before, big, x.after].filter(v => v?.trim()).join(' ').replace(/\s+/g, ' ').replace(/ ([.,!?:;%])/g, '$1').trim()
    if (line)
      return line
  }
  const raw = it.kind === 'cover' ? d.value.copy.cover?.trim() || template.value.cover : d.value.copy[it.key]?.trim() || it.entry?.def.copy || ''
  // This person doesn't get it: the words everyone shares filled in, their numbers as "…".
  const known: Record<string, string> = { first_name: person.value, business: business.value.name, year: String(ws.campaign.value?.year ?? ''), items_label: d.value.items_label }
  return raw.replace(/\{([\w:]+)\}/g, (_, k: string) => known[k] || '…')
}
const ink = computed(() => d.value.theme === 'paper' ? '#1A1A1A' : readableOn(business.value.accent_color))

function statusOf(it: Item): string {
  if (it.kind === 'add')
    return ws.isBusiness.value ? '' : 'Show any column of your sheet, or how someone ranks by one of its numbers.'
  if (it.entry?.hidden)
    return 'Hidden: nobody gets this slide. Show it again with the eye.'
  const rule = it.entry && !ws.isBusiness.value ? ` ${ruleOf(it.entry)}` : ''
  if (it.kind === 'photos')
    return ws.photos.value.length ? `${ws.photos.value.length} ${ws.photos.value.length === 1 ? 'photo' : 'photos'}, one slide each, before the note. The same for everyone.` : 'The same photos for everyone, one slide each, before the note.'
  const i = indexOf(it.key)
  if (player.value && i < 0)
    return `${person.value} doesn't get this slide.${rule}`
  return `${player.value && i >= 0 ? `Slide ${i + 1} of ${player.value.count} in ${person.value}'s Highreel.` : ''}${rule}`.trim()
}

// Placeholders a line offers: the slide's own column first, then the ones every line has.
function tokensFor(it: Item) {
  const out: { key: string }[] = []
  const col = it.entry && !it.entry.def.list ? it.entry.def.column : null
  if (col)
    out.push({ key: col })
  out.push({ key: 'first_name' }, { key: 'business' }, { key: 'year' })
  if (template.value.itemsLabel && it.kind === 'slide')
    out.push({ key: 'items_label' })
  return out
}
function moreFor(it: Item) {
  const col = it.entry?.def.column
  return it.kind === 'slide' ? columns.value.filter(c => slideable(c, base.value) && c.key !== col).map(c => ({ key: c.key, label: colName(c) })) : []
}

// --- Save -------------------------------------------------------------------------
const saving = ref(false)
async function save() {
  saving.value = true
  const ok = await ws.saveDesign()
  saving.value = false
  if (ok)
    toast.success('Design saved', { description: ws.isPublished.value ? 'Published Highreels show it now.' : undefined })
}
function discard() {
  ws.draft.value = saved()
}
</script>

<template>
  <div v-if="ws.draft.value" class="flex min-h-0 flex-1">
    <form class="flex min-w-0 flex-1 flex-col" @submit.prevent="save">
      <div class="relative flex min-h-0 flex-1 flex-col max-md:overflow-y-auto md:flex-row">
        <!-- The rail -->
        <nav ref="rail" class="rail relative flex shrink-0 flex-col gap-5 border-b px-3 pt-4 pb-4 md:w-[272px] md:overflow-y-auto md:border-r md:border-b-0" :class="{ sorting: sort.dragging.value }" aria-label="Slides">
          <div class="flex flex-col gap-2 px-1">
            <p class="rail-label">Look</p>
            <Segmented v-slot="{ option }" v-model="d.theme" :options="themes" label="Theme" block data-testid="theme">
              <span class="flex h-4 w-3 shrink-0 flex-col overflow-hidden rounded-[3px] ring-1 ring-black/10" aria-hidden="true">
                <span class="h-1" :style="{ background: business.accent_color }" />
                <span class="flex-1" :style="{ background: themeBody(option.value) }" />
              </span>
              {{ option.label }}
            </Segmented>
            <div class="flex items-start gap-2.5 pt-1.5">
              <Switch id="d-guess" v-model="d.guess_first" size="sm" class="mt-0.5" data-testid="guess-first" />
              <Label for="d-guess" class="flex-col items-start gap-0 text-[13px] leading-snug">
                <span class="font-medium">Guess first</span>
                <span class="text-[12px] font-normal text-muted-foreground">People guess their number before it's revealed.</span>
              </Label>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <p class="rail-label px-1">Slides</p>
            <div class="row-wrap" :class="{ on: active === 'cover' }" data-slide="cover">
              <span class="grip-space" aria-hidden="true" />
              <button type="button" class="row" :aria-current="active === 'cover' ? 'true' : undefined" @click="select('cover')">
                <Sparkles class="row-icon" />
                <span class="row-text"><span class="row-name">Cover</span><span class="row-line">{{ lineOf(cover) }}</span></span>
              </button>
            </div>
            <ul ref="sortList" class="flex flex-col gap-1">
              <li
                v-for="it in movable"
                :key="it.key"
                class="row-wrap"
                :class="{ on: active === it.key, off: it.entry?.hidden, lifted: sort.dragging.value === it.key }"
                :data-slide="it.key"
                :data-sort-key="it.key"
                :style="sort.style(it.key)"
              >
                <span v-if="movable.length < 2" class="grip-space" aria-hidden="true" />
                <button
                  v-else
                  type="button"
                  class="grip"
                  :aria-label="`Move ${it.title.toLowerCase()}: drag, or use the arrow keys`"
                  @pointerdown="sort.start($event, it.key)"
                  @keydown.up.prevent="moveByKey(it.key, -1)"
                  @keydown.down.prevent="moveByKey(it.key, 1)"
                >
                  <GripVertical class="size-3.5" />
                </button>
                <button type="button" class="row" :aria-current="active === it.key ? 'true' : undefined" @click="select(it.key)">
                  <component :is="it.icon" class="row-icon" />
                  <span class="row-text"><span class="row-name">{{ it.title }}</span><span class="row-line">{{ lineOf(it) }}</span></span>
                  <UserX v-if="!it.entry?.hidden && !shown(it.key)" class="ml-auto size-3.5 shrink-0 text-muted-foreground/70" :aria-label="`Not in ${person}'s Highreel`" data-not-shown />
                </button>
                <Button type="button" variant="ghost" size="icon-xs" class="eye" :aria-label="it.entry?.hidden ? `Show ${it.title.toLowerCase()}` : `Hide ${it.title.toLowerCase()}`" :aria-pressed="!it.entry?.hidden" @click="toggleHidden(it.key)">
                  <EyeOff v-if="it.entry?.hidden" />
                  <Eye v-else />
                </Button>
              </li>
            </ul>
            <div v-if="!ws.isBusiness.value" class="row-wrap short" :class="{ on: active === 'add' }" data-slide="add">
              <span class="grip-space" aria-hidden="true" />
              <button type="button" class="row add-row" :aria-current="active === 'add' ? 'true' : undefined" @click="select('add')">
                <Plus class="row-icon" /> <span>Add a slide</span>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <p class="rail-label px-1">Always at the end</p>
            <div v-for="it in tail" :key="it.key" class="row-wrap" :class="{ on: active === it.key }" :data-slide="it.key">
              <span class="grip-space" aria-hidden="true" />
              <button type="button" class="row" :aria-current="active === it.key ? 'true' : undefined" @click="select(it.key)">
                <component :is="it.icon" class="row-icon" />
                <span class="row-text"><span class="row-name">{{ it.title }}</span><span class="row-line">{{ lineOf(it) }}</span></span>
              </button>
            </div>
          </div>

          <NuxtLink to="/app/brand" class="brand-chip group mt-auto">
            <span class="size-5 shrink-0 rounded-full" :style="{ background: business.accent_color }" aria-hidden="true" />
            <span class="min-w-0 flex-1 leading-tight"><span class="block truncate font-medium">{{ business.name }}</span><span class="text-[11.5px] text-muted-foreground">Colour and logo: Your brand</span></span>
            <ArrowRight class="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </NuxtLink>
          <p class="sr-only" aria-live="polite">{{ live }}</p>
        </nav>

        <!-- The inspector -->
        <section class="relative min-w-0 flex-1 md:overflow-y-auto" :data-inspector="current.key">
          <div class="mx-auto flex max-w-[600px] flex-col gap-6 px-6 pt-7 pb-16 xl:px-8">
            <header class="flex flex-col gap-2">
              <div class="flex items-center gap-3">
                <span class="ins-icon" :class="{ off: current.entry?.hidden }"><component :is="current.icon" class="size-4" /></span>
                <h2 class="min-w-0 truncate text-[22px] leading-tight font-semibold tracking-[-0.015em]">{{ current.title }}</h2>
                <span v-if="columnOf(current)" class="col-badge" :title="`This slide shows the ${columnOf(current)} column`">{{ columnOf(current) }}</span>
                <span class="flex-1" />
                <div v-if="current.entry" class="flex shrink-0 items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Move earlier" :disabled="entries[0]?.def.key === current.key" @click="move(current.key, -1)"><ArrowUp /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Move earlier</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Move later" :disabled="entries[entries.length - 1]?.def.key === current.key" @click="move(current.key, 1)"><ArrowDown /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Move later</TooltipContent>
                  </Tooltip>
                  <Button type="button" variant="outline" size="sm" class="ml-1.5" @click="toggleHidden(current.key)">
                    <Eye v-if="current.entry.hidden" /><EyeOff v-else /> {{ current.entry.hidden ? 'Show' : 'Hide' }}
                  </Button>
                  <Tooltip v-if="current.entry.def.added">
                    <TooltipTrigger as-child>
                      <Button type="button" variant="ghost" size="icon-sm" class="ml-0.5 hover:text-destructive" aria-label="Remove slide" @click="remove(current.key)"><Trash2 /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove slide</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <p v-if="statusOf(current)" class="text-[13px] leading-snug text-muted-foreground" data-testid="slide-status">{{ statusOf(current) }}</p>
            </header>

            <!-- Cover -->
            <template v-if="current.kind === 'cover'">
              <div class="field">
                <Label for="d-copy-cover">Line</Label>
                <PlaceholderField id="d-copy-cover" v-model="d.copy.cover" :placeholder="template.cover" :tokens="tokensFor(current)" />
              </div>
              <NuxtLink to="/app/brand" class="group inline-flex w-fit items-center gap-2.5 rounded-full bg-muted py-1.5 pr-3.5 pl-1.5 text-[13px] hover:bg-accent">
                <span class="size-6 shrink-0 rounded-full" :style="{ background: business.accent_color }" aria-hidden="true" />
                <span><span class="font-medium">Logo and colour</span><span class="text-muted-foreground"> come from Your brand</span></span>
                <ArrowRight class="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </NuxtLink>
            </template>

            <!-- A slide -->
            <template v-else-if="current.kind === 'slide' && current.entry && !current.entry.hidden">
              <div class="field">
                <Label :for="`d-copy-${current.key}`">Line</Label>
                <PlaceholderField :id="`d-copy-${current.key}`" :key="current.key" v-model="d.copy[current.key]" :placeholder="current.entry.def.copy" :tokens="tokensFor(current)" :more="moreFor(current)" />
              </div>

              <div v-if="isItemsSlide(current.entry.def) && template.itemsLabel" class="field">
                <Label for="d-items">{{ template.itemsLabel.title }}</Label>
                <Input id="d-items" v-model="d.items_label" maxlength="40" :placeholder="template.itemsLabel.placeholder" class="max-w-xs" />
                <p class="hint">Goes with <span class="font-mono">{{ template.itemsLabel.column }}</span>. Blank hides this slide.</p>
              </div>

              <div v-if="current.entry.def.list && current.entry.def.added" class="field">
                <span class="label">Columns</span>
                <div class="flex flex-wrap items-center gap-1.5" :data-list-columns="current.key">
                  <Badge v-for="c in listColumns(current.entry)" :key="c" variant="secondary" class="h-7 gap-0.5 pr-0.5 pl-3 text-[12px] font-normal" :data-list-column="c">
                    {{ colLabel(c) }}
                    <Button type="button" variant="ghost" size="icon-xs" class="size-5" :aria-label="`Take ${colLabel(c)} off the list`" :disabled="listColumns(current.entry).length < 2" @click="dropFromList(current.key, c)">×</Button>
                  </Badge>
                  <DropdownMenu v-if="listColumns(current.entry).length < MAX_LIST && listOptions(current.entry).length">
                    <DropdownMenuTrigger as-child>
                      <Button type="button" variant="outline" size="xs" data-testid="list-add"><Plus /> Add a column</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" class="max-h-72 overflow-y-auto">
                      <DropdownMenuItem v-for="c in listOptions(current.entry)" :key="c.key" @select="addToList(current.key, c.key)">{{ colName(c) }}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div v-if="scenesFor(current.entry.def).length > 1" class="field">
                <span :id="`d-scene-${current.key}`" class="label">Animation</span>
                <RadioGroup :model-value="sceneOf(current.entry.def)" class="grid grid-cols-2 gap-2 xl:grid-cols-3" :aria-labelledby="`d-scene-${current.key}`" @update:model-value="pickScene(current.key, $event)">
                  <Label
                    v-for="sc in scenesFor(current.entry.def)"
                    :key="sc"
                    :for="`d-sc-${current.key}-${sc}`"
                    class="tile"
                    :data-checked="sceneOf(current.entry.def) === sc"
                    :data-scene-option="sc"
                  >
                    <span class="flex w-full items-center gap-1.5 font-medium">
                      <component :is="SCENE_ICONS[sc]" class="size-3.5 shrink-0" />
                      <span class="min-w-0 flex-1 truncate">{{ SCENES[sc].label }}</span>
                      <RadioGroupItem :id="`d-sc-${current.key}-${sc}`" :value="sc" class="size-3.5" />
                    </span>
                    <span class="text-[12px] leading-snug font-normal text-muted-foreground">{{ SCENES[sc].hint }}</span>
                  </Label>
                </RadioGroup>
              </div>

              <div v-if="sceneOf(current.entry.def) === 'count'" class="field">
                <span :id="`d-tokens-${current.key}`" class="label">Tokens</span>
                <Segmented
                  :model-value="current.entry.def.tokens ?? 'shapes'"
                  :options="tokenOptions"
                  label="Tokens"
                  data-testid="tokens"
                  class="w-fit"
                  @update:model-value="tk => { setOption(current.key, { tokens: tk === 'shapes' ? undefined : tk }); jump(current.key) }"
                />
              </div>

              <div v-if="sceneOf(current.entry.def) === 'days'" class="field">
                <span :id="`d-span-${current.key}`" class="label">Calendar</span>
                <Segmented
                  :model-value="current.entry.def.span ?? 'year'"
                  :options="spanOptions"
                  label="Calendar"
                  class="w-fit"
                  @update:model-value="sp => { setOption(current.key, { span: sp }); jump(current.key) }"
                />
              </div>

              <div v-if="!ws.isBusiness.value && (showsFrom(current.entry.def) || isTop(current.entry.def) || (current.entry.def.added && current.entry.setting.show !== 'top' && !current.entry.def.list))" class="flex flex-wrap items-end gap-x-6 gap-y-4">
                <NumberField v-if="showsFrom(current.entry.def)" :id="`d-min-${current.key}`" :key="`min-${current.key}`" class="field w-32" :min="0" :model-value="current.entry.def.min ?? 0" @update:model-value="v => setOption(current.key, { min: Math.max(0, Math.round(Number(v) || 0)) })">
                  <Label :for="`d-min-${current.key}`">Shows from</Label>
                  <NumberFieldContent>
                    <NumberFieldDecrement />
                    <NumberFieldInput class="font-mono" />
                    <NumberFieldIncrement />
                  </NumberFieldContent>
                </NumberField>
                <NumberField v-else-if="isTop(current.entry.def)" :id="`d-max-${current.key}`" :key="`max-${current.key}`" class="field w-32" :min="1" :max="100" :model-value="current.entry.def.max ?? DEFAULT_TOP" @update:model-value="v => setOption(current.key, { max: Math.min(100, Math.max(1, Math.round(Number(v) || DEFAULT_TOP))) })">
                  <Label :for="`d-max-${current.key}`">Shows to the top (%)</Label>
                  <NumberFieldContent>
                    <NumberFieldDecrement />
                    <NumberFieldInput class="font-mono" />
                    <NumberFieldIncrement />
                  </NumberFieldContent>
                </NumberField>
                <div v-if="current.entry.def.added && current.entry.setting.show !== 'top' && !current.entry.def.list" class="field">
                  <Label :for="`d-label-${current.key}`">Name on the share card</Label>
                  <Input :id="`d-label-${current.key}`" :model-value="current.entry.setting.label ?? ''" maxlength="40" :placeholder="current.entry.def.label.toLowerCase()" class="w-52" @update:model-value="setOption(current.key, { label: String($event).trim() || undefined })" />
                </div>
              </div>
            </template>

            <!-- Add a slide -->
            <template v-else-if="current.kind === 'add'">
              <div class="add-grid">
                <div class="add-card">
                  <p class="flex items-center gap-2 font-semibold"><Hash class="size-4" /> A column's value</p>
                  <p class="hint">Their number, word or date from the sheet, with its own animation.</p>
                  <div class="flex gap-2">
                    <Select v-model="addValue" :disabled="!addable.length">
                      <SelectTrigger class="h-8 min-w-0 flex-1 rounded-full bg-background" aria-label="Column to show" data-testid="add-value">
                        <SelectValue :placeholder="addable.length ? 'Pick a column…' : 'Every column has a slide'" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem v-for="c in addable" :key="c.key" :value="c.key">{{ colName(c) }}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" aria-label="Add a slide for this column" :disabled="!addValue" @click="addPicked('value')">Add</Button>
                  </div>
                </div>
                <div class="add-card">
                  <p class="flex items-center gap-2 font-semibold"><Percent class="size-4" /> Top % by a number</p>
                  <p class="hint">"You're in the top 8%", for people near the top. Ranked when you publish.</p>
                  <div class="flex gap-2">
                    <Select v-model="addTop" :disabled="!rankable.length">
                      <SelectTrigger class="h-8 min-w-0 flex-1 rounded-full bg-background" aria-label="Number to rank by" data-testid="add-top">
                        <SelectValue :placeholder="rankable.length ? 'Rank by…' : 'No number columns left'" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem v-for="c in rankable" :key="c.key" :value="c.key">{{ colName(c) }}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" aria-label="Add a top % slide" :disabled="!addTop" @click="addPicked('top')">Add</Button>
                  </div>
                </div>
                <div v-if="listable.length >= 2" class="add-card">
                  <p class="flex items-center gap-2 font-semibold"><ListOrdered class="size-4" /> A list</p>
                  <p class="hint">Up to {{ MAX_LIST }} columns on one slide, one line each with its name.</p>
                  <Button type="button" size="sm" variant="outline" class="w-fit" data-testid="add-list" @click="addList">Add a list</Button>
                </div>
                <div class="add-card">
                  <p class="flex items-center gap-2 font-semibold"><Columns3 class="size-4" /> A new column</p>
                  <p class="hint">It shows up in the Sheet and the sheet you download, empty until you fill it in.</p>
                  <div class="flex flex-wrap gap-2">
                    <Input v-model="newName" maxlength="40" placeholder="Like “gifts made”" class="h-8 min-w-0 flex-1" aria-label="New column name" @keydown.enter.prevent="addColumn" />
                    <Select v-model="newType">
                      <SelectTrigger class="h-8 rounded-full bg-background" aria-label="New column type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectItem v-for="o in typeOptions" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" :disabled="!newName.trim()" @click="addColumn">Add column</Button>
                  </div>
                </div>
              </div>
            </template>

            <!-- Group photos -->
            <PhotosSection v-else-if="current.kind === 'photos'" />

            <!-- The note -->
            <template v-else-if="current.kind === 'note'">
              <p v-if="ws.isBusiness.value" class="hint">Written with your numbers, in <NuxtLink :to="`/app/c/${ws.campaign.value?.id}`" class="underline underline-offset-2">Content</NuxtLink>.</p>
              <div v-else class="field">
                <Label for="d-note">{{ noteLabel }}</Label>
                <Textarea id="d-note" v-model="d.founder_note" maxlength="280" rows="4" class="min-h-0" />
                <p v-if="template.noteColumn" class="hint">Used when a row has no <span class="font-mono">{{ template.noteColumn }}</span> of its own.</p>
              </div>
            </template>

            <!-- The last slide -->
            <template v-else-if="current.kind === 'button'">
              <p class="hint">The share card, Save image and Share are always there. Add a button after them, or leave it blank for none.</p>
              <div class="grid grid-cols-[1fr_1.4fr] gap-3">
                <div class="field">
                  <Label for="d-cta">Button label</Label>
                  <Input id="d-cta" v-model="d.cta_label" maxlength="32" placeholder="Invite a friend" />
                </div>
                <div class="field">
                  <Label for="d-cta-url">Button link</Label>
                  <Input id="d-cta-url" v-model="d.cta_url" placeholder="https://" />
                </div>
              </div>
            </template>
          </div>
        </section>
      </div>

      <div class="flex shrink-0 items-center gap-2 border-t bg-background px-5 py-2.5">
        <span class="text-[13px] text-muted-foreground">{{ ws.designDirty.value ? 'Unsaved changes' : 'All changes saved' }}</span>
        <Button type="button" variant="ghost" size="sm" class="ml-auto" :disabled="!ws.designDirty.value || saving" @click="discard">Discard</Button>
        <Button type="submit" size="sm" class="px-4" :disabled="!ws.designDirty.value || saving">{{ saving ? 'Saving…' : 'Save' }}</Button>
      </div>
    </form>

    <PhoneStage ref="stage" :payload="payload" :accent="business.accent_color" :ink="ink">
      <template v-if="ws.previewIsExample.value">An example person until your sheet is in.</template>
      <template v-else-if="!ws.isBusiness.value">Previewing {{ person }}. Pick someone else in the Sheet.</template>
    </PhoneStage>
  </div>
</template>

<style scoped>
.rail { background: var(--subtle); }
.rail.sorting { user-select: none; }
.rail-label {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}
.row-wrap {
  position: relative;
  display: flex;
  align-items: center;
  height: 44px;
  border-radius: 12px;
  transition: transform 160ms var(--ease-out, ease), background-color 120ms ease, box-shadow 120ms ease;
}
.row-wrap.short { height: 36px; }
.row-wrap:hover { background: color-mix(in oklab, var(--foreground) 5%, transparent); }
.row-wrap.on {
  background: var(--background);
  box-shadow: 0 0 0 1.5px var(--primary);
}
.row-wrap.lifted {
  background: var(--background);
  box-shadow: 0 0 0 1.5px var(--primary), 0 10px 24px -8px rgb(0 0 0 / 0.25);
}
.row-wrap.off .row { color: var(--muted-foreground); }
.row-wrap.off .row-name { text-decoration: line-through; text-decoration-color: color-mix(in oklab, currentColor 50%, transparent); }
.grip,
.grip-space {
  display: grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 100%;
}
.grip {
  border-radius: 8px 0 0 8px;
  color: color-mix(in oklab, var(--muted-foreground) 70%, transparent);
  cursor: grab;
  touch-action: none;
}
.grip:hover, .grip:focus-visible { color: var(--foreground); }
.rail.sorting .grip { cursor: grabbing; }
.row {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 100%;
  padding-right: 8px;
  font-size: 13.5px;
  text-align: left;
}
.row-text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  line-height: 1.2;
}
.row-name { font-size: 13px; }
.row-line {
  overflow: hidden;
  color: var(--muted-foreground);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-wrap.on .row-name { font-weight: 600; }
.col-badge {
  flex: none;
  max-width: 40%;
  overflow: hidden;
  padding: 2px 8px;
  border-radius: 9999px;
  background: var(--muted);
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row :deep(.row-icon) {
  width: 15px;
  height: 15px;
  flex: none;
  color: var(--muted-foreground);
}
.row-wrap.on .row :deep(.row-icon) { color: var(--primary); }
.add-row { color: var(--primary); font-weight: 500; }
.add-row :deep(.row-icon) { color: var(--primary) !important; }
.eye {
  flex: none;
  margin-right: 5px;
  color: color-mix(in oklab, var(--muted-foreground) 75%, transparent);
}
.row-wrap.off .eye { color: var(--foreground); }
.brand-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 14px;
  font-size: 13px;
}
.brand-chip:hover { background: color-mix(in oklab, var(--foreground) 5%, transparent); }
.ins-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: color-mix(in oklab, var(--primary) 12%, var(--background));
  color: var(--primary);
}
.ins-icon.off { background: var(--muted); color: var(--muted-foreground); }
.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.field :deep(label),
.label {
  font-size: 13px;
  font-weight: 500;
}
.hint {
  font-size: 13px;
  color: var(--muted-foreground);
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px var(--border);
  font-size: 13px;
  text-align: left;
  transition: box-shadow 150ms ease, background-color 150ms ease;
}
.tile:hover { background: var(--subtle); }
.tile[data-checked='true'] {
  background: color-mix(in oklab, var(--primary) 6%, var(--background));
  box-shadow: inset 0 0 0 1.5px var(--primary);
  color: var(--primary);
}
.add-grid {
  display: grid;
  gap: 10px;
}
.add-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px 16px;
  border-radius: 18px;
  background: var(--muted);
  font-size: 14px;
}
.add-card :deep(input) { background: var(--background); }
</style>
