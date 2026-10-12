<script setup lang="ts">
// The business's own recap (SPEC M2.5 P4), its Content tab (M2.6): a form
// instead of a grid, with the live preview beside it. Up to four headline
// numbers (with suggestions from this year's customer recaps), the
// highlight, three milestones and the thank-you note. Photos and wording are
// in Design; the link and images in Share. Unsaved values survive switching
// tabs (ws.formDraft).
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Suggestion } from '#shared/utils/suggest'
import { normalizeRaw } from '#shared/utils/validate'

const ws = useWorkspace()
const { api } = useApi()

const STATS = [1, 2, 3, 4]
const MILESTONES = [1, 2, 3]

function saved() {
  return {
    raw: normalizeRaw(ws.rows.value[0]?.raw ?? {}, ws.template.value),
    note: ws.campaign.value?.settings.founder_note ?? '',
  }
}
const form = ref(ws.formDraft.value ? { raw: { ...ws.formDraft.value.raw }, note: ws.formDraft.value.note } : saved())
// The preview plays the form as it's typed; the draft outlives this tab.
watch(form, (f) => {
  ws.formDraft.value = { raw: { ...f.raw }, note: f.note }
}, { deep: true, immediate: true })

const dirty = computed(() => JSON.stringify(form.value) !== JSON.stringify(saved()))
const errors = computed(() => ws.businessRow.value.errors)
const tried = ref(false)
/** Show a field's error once it has a value or after a save attempt. */
const errorFor = (key: string) => (tried.value || form.value.raw[key] ? errors.value[key] : undefined)

const saving = ref(false)
async function save(): Promise<boolean> {
  if (!dirty.value)
    return true
  tried.value = true
  saving.value = true
  const ok = await ws.saveBusiness(form.value.raw, form.value.note)
  saving.value = false
  if (ok) {
    form.value = saved()
    toast.success('Saved', { description: ws.isPublished.value ? 'Your published highlight reel shows it now.' : undefined })
  }
  return ok
}
ws.setFormSaver(async () => {
  tried.value = true
  return save()
})
onBeforeUnmount(() => ws.setFormSaver(async () => {
  // Off this tab: save the kept draft if there is one.
  const d = ws.formDraft.value
  return !d || JSON.stringify(d) === JSON.stringify(saved()) || ws.saveBusiness(d.raw, d.note)
}))
function discard() {
  form.value = saved()
  tried.value = false
}

/** "1,240" → "1240" (whole numbers only). */
function cleanNumber(key: string) {
  form.value.raw[key] = (form.value.raw[key] ?? '').replace(/[,\s]/g, '')
}

// Suggestions from this year's customer recaps.
const suggestions = ref<Suggestion[]>([])
onMounted(async () => {
  try {
    suggestions.value = await api<Suggestion[]>(`/api/campaigns/${ws.campaign.value!.id}/suggestions`)
  }
  catch {}
})
const used = computed(() => new Set(STATS.map(n => form.value.raw[`stat_${n}_label`]).filter(Boolean)))
function useSuggestion(s: Suggestion) {
  const n = STATS.find(n => !form.value.raw[`stat_${n}`] && !form.value.raw[`stat_${n}_label`])
  if (!n) {
    toast('All four numbers are filled in', { description: 'Clear one to use this.' })
    return
  }
  form.value.raw[`stat_${n}`] = String(s.value)
  form.value.raw[`stat_${n}_label`] = s.label
}

const fmt = (n: number) => n.toLocaleString('en-US')
</script>

<template>
  <div class="h-full overflow-y-auto">
    <form class="mx-auto flex max-w-2xl flex-col gap-8 px-6 pt-8 pb-24" novalidate @submit.prevent="save">
      <header class="flex flex-col gap-1.5">
        <p class="note-hand text-[24px]">step one, your {{ ws.campaign.value?.year }}</p>
        <h1 class="text-[32px] leading-tight font-semibold tracking-[-0.025em] text-balance">Tell your followers about your year</h1>
        <p class="text-muted-foreground">One highlight reel about {{ ws.business.value?.name }}, to post on Instagram, Facebook or LinkedIn. The preview plays it as you type; nothing is public until you publish.</p>
      </header>

      <section class="flex flex-col gap-3" aria-labelledby="bf-numbers">
        <div>
          <p id="bf-numbers" class="section-title">Headline numbers</p>
          <p class="hint">Up to four, each on its own slide. The first one is required.</p>
        </div>
        <div v-for="n in STATS" :key="n" class="grid grid-cols-[20px_120px_1fr] items-start gap-2">
          <span class="pt-1.5 text-right font-mono text-[11px] text-muted-foreground">{{ n }}</span>
          <div class="flex flex-col gap-1">
            <Input
              v-model="form.raw[`stat_${n}`]"
              inputmode="numeric"
              :placeholder="n === 1 ? '1240' : ''"
              :aria-label="`Number ${n}`"
              :aria-invalid="!!errorFor(`stat_${n}`)"
              class="h-8 text-right font-mono"
              @blur="cleanNumber(`stat_${n}`)"
            />
            <p v-if="errorFor(`stat_${n}`)" class="err">{{ errorFor(`stat_${n}`) }}</p>
          </div>
          <div class="flex flex-col gap-1">
            <Input
              v-model="form.raw[`stat_${n}_label`]"
              maxlength="40"
              :placeholder="n === 1 ? 'customers served' : n === 2 ? 'new members' : ''"
              :aria-label="`What number ${n} counts`"
              :aria-invalid="!!errorFor(`stat_${n}_label`)"
              class="h-8"
            />
            <p v-if="errorFor(`stat_${n}_label`)" class="err">{{ errorFor(`stat_${n}_label`) }}</p>
          </div>
        </div>
        <div v-if="suggestions.length" class="flex flex-col gap-1.5 pl-7">
          <p class="hint">From your {{ ws.campaign.value?.year }} highlight reels:</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="s in suggestions"
              :key="s.label"
              type="button"
              class="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-3 text-[12px] hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              :disabled="used.has(s.label)"
              data-testid="suggestion"
              @click="useSuggestion(s)"
            >
              <span class="font-mono font-medium">{{ fmt(s.value) }}</span> {{ s.label }}
            </button>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-1.5">
        <Label for="bf-highlight" class="section-title">Highlight of the year</Label>
        <Input id="bf-highlight" v-model="form.raw.highlight" maxlength="80" placeholder="Our first pop-up market" class="h-8" :aria-invalid="!!errorFor('highlight')" />
        <p v-if="errorFor('highlight')" class="err">{{ errorFor('highlight') }}</p>
      </section>

      <section class="flex flex-col gap-2" aria-labelledby="bf-milestones">
        <div>
          <p id="bf-milestones" class="section-title">Milestones</p>
          <p class="hint">Up to three. Start with a month and a colon to show it as a date.</p>
        </div>
        <div v-for="n in MILESTONES" :key="n" class="flex flex-col gap-1">
          <Input
            v-model="form.raw[`milestone_${n}`]"
            maxlength="80"
            :placeholder="n === 1 ? 'March: opened our second location' : n === 2 ? 'July: our 1,000th order' : ''"
            :aria-label="`Milestone ${n}`"
            class="h-8"
          />
          <p v-if="errorFor(`milestone_${n}`)" class="err">{{ errorFor(`milestone_${n}`) }}</p>
        </div>
      </section>

      <section class="flex flex-col gap-1.5">
        <Label for="bf-note" class="section-title">Thank-you note</Label>
        <Textarea id="bf-note" v-model="form.note" maxlength="280" rows="3" class="min-h-0 text-[13px]" />
        <p class="hint">The last slide before the share card.</p>
      </section>

      <div class="sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
        <span v-if="dirty" class="mr-auto text-[12px] text-muted-foreground">Unsaved changes</span>
        <Button type="button" variant="ghost" size="sm" :disabled="!dirty || saving" @click="discard">Discard</Button>
        <Button type="submit" size="sm" :disabled="!dirty || saving">{{ saving ? 'Saving…' : 'Save' }}</Button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--foreground);
}
.hint {
  font-size: 12px;
  color: var(--muted-foreground);
}
.err {
  font-size: 11.5px;
  color: var(--destructive);
}
</style>
