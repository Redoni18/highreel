<script setup lang="ts">
// New Highreel (SPEC M2b, M2.5 P3/P4, M2.17), a wizard since 2026-10-15
// (owner: all in one dialog was overwhelming). Step 1, what it is: one for each
// customer or one about the business's own year, its name and year. Step 2,
// for customers only: the business type (shared/templates/starters.ts: its
// sheet and wording). Step 3: the look, a design and one of its colourways
// (shared/templates/designs.ts), which starts as the business type's
// suggestion and follows the type until it's picked by hand. Cancel or Back,
// then Continue, and Create on the last step. Used by the home and the
// campaign switcher; the caller creates it.
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { CampaignKind } from '#shared/types/recap'
import { templates } from '#shared/templates'
import { DEFAULT_LOOK, getDesign, type Look } from '#shared/templates/designs'
import { getStarter, starters } from '#shared/templates/starters'

interface NewRecapInput { name: string, year: number, template_key: string, starter?: string, look: Look }

const props = withDefaults(defineProps<{
  create: (input: NewRecapInput) => Promise<boolean>
  kind?: CampaignKind
}>(), { kind: 'customers' })
const open = defineModel<boolean>('open', { default: false })

const businessTemplate = Object.values(templates).find(t => t.kind === 'business')

const kind = ref<CampaignKind>(props.kind)
const year = ref(new Date().getFullYear())
const name = ref('')
const starterKey = ref(starters[0]!.key)
const saving = ref(false)

// The look: the business type's suggestion until it's picked by hand.
const suggested = (): Look => ({ ...(kind.value === 'business' ? DEFAULT_LOOK : getStarter(starterKey.value)!.look) })
const look = ref<Look>(suggested())
const lookTouched = ref(false)
watch([kind, starterKey], () => {
  if (!lookTouched.value)
    look.value = suggested()
})
function pickLook(l: Look) {
  look.value = l
  lookTouched.value = true
}

const defaultName = (k: CampaignKind, y: number) => (k === 'business' ? `Our ${y}` : `${y} Highreels`)
// Keep the suggested name in step with kind and year until it's edited.
const touched = ref(false)
watch([kind, year], () => {
  if (!touched.value)
    name.value = defaultName(kind.value, Number(year.value))
})
// The steps: a business's own Highreel has no business type to pick.
type Step = 'what' | 'type' | 'look'
const steps = computed<Step[]>(() => (kind.value === 'business' ? ['what', 'look'] : ['what', 'type', 'look']))
const step = ref<Step>('what')
const at = computed(() => steps.value.indexOf(step.value))
const last = computed(() => at.value === steps.value.length - 1)
const STEPS: Record<Step, { title: string, description: string }> = {
  what: { title: 'What are you making?', description: 'A Highreel for each of your customers, or one about your business\'s year. Then its name.' },
  type: { title: 'What kind of business is it for?', description: 'It sets the sheet\'s columns and what the slides say. You can rewrite any line later.' },
  look: { title: 'How should it look?', description: 'Pick a design and its colors. You can change it any time in Design.' },
}
// Where the look came from, under step 3's question.
const lookFrom = computed(() => {
  const d = getDesign(look.value.design)
  const c = d.colorways.find(x => x.key === look.value.colorway) ?? d.colorways[0]!
  return kind.value === 'customers' && !lookTouched.value ? `${getStarter(starterKey.value)!.label} starts you in ${d.label}, ${c.label}.` : ''
})
function back() {
  if (at.value > 0)
    step.value = steps.value[at.value - 1]!
  else
    open.value = false
}
// Enter and Continue go to the next step; on the last one they create it.
function next() {
  if (last.value)
    submit()
  else
    step.value = steps.value[at.value + 1]!
}

watch(open, (v) => {
  if (v) {
    step.value = 'what'
    kind.value = businessTemplate ? props.kind : 'customers'
    year.value = new Date().getFullYear()
    name.value = defaultName(kind.value, year.value)
    starterKey.value = starters[0]!.key
    touched.value = false
    lookTouched.value = false
    look.value = suggested()
  }
})

async function submit() {
  saving.value = true
  const starter = getStarter(starterKey.value)!
  const input: NewRecapInput = kind.value === 'business' && businessTemplate
    ? { name: name.value.trim(), year: Number(year.value), template_key: businessTemplate.key, look: look.value }
    : { name: name.value.trim(), year: Number(year.value), template_key: starter.template, starter: starter.key, look: look.value }
  const ok = await props.create(input)
  saving.value = false
  if (ok)
    open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
      <!-- The question on top, the step's choices scrolling under it when they don't fit (a phone), the buttons
           always in reach at the bottom. Each step is as tall as its content (owner, 2026-10-15: a shared
           minimum height left a gap above the buttons on the short steps). -->
      <form class="flex min-h-0 flex-1 flex-col gap-6" :data-step="step" @submit.prevent="next">
        <DialogHeader class="gap-5">
          <div class="flex flex-col gap-2.5">
            <DialogTitle>New Highreel</DialogTitle>
            <div class="flex items-center gap-3" data-testid="wizard-progress">
              <span class="flex gap-1" aria-hidden="true">
                <span v-for="(s, i) in steps" :key="s" class="h-1 w-8 rounded-full transition-colors" :class="i <= at ? 'bg-primary' : 'bg-muted'" />
              </span>
              <span class="font-mono text-[12px] text-muted-foreground">Step {{ at + 1 }} of {{ steps.length }}</span>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <h3 class="text-[19px] leading-tight font-semibold tracking-[-0.015em]" data-testid="step-title">{{ STEPS[step].title }}</h3>
            <DialogDescription class="leading-relaxed">
              {{ STEPS[step].description }}<span v-if="step === 'look' && lookFrom" data-testid="look-from">{{ ` ${lookFrom}` }}</span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div class="-mx-1 -my-1 min-h-0 flex-1 overflow-y-auto px-1 py-1">
        <!-- 1. What it is, and its name -->
        <div v-if="step === 'what'" class="flex flex-col gap-6" data-step-body="what">
          <RadioGroup v-if="businessTemplate" v-model="kind" class="grid gap-2 sm:grid-cols-2" aria-label="What kind of Highreel">
            <Label
              v-for="k in (['customers', 'business'] as const)"
              :key="k"
              :for="`nr-kind-${k}`"
              class="choice flex-col items-start gap-1 p-4 text-[12px] font-normal"
              :data-checked="kind === k"
            >
              <span class="flex w-full items-center justify-between gap-2 text-[15px] font-semibold">{{ k === 'customers' ? 'For each customer' : 'Your business year' }}<RadioGroupItem :id="`nr-kind-${k}`" :value="k" /></span>
              <span class="text-[13px] leading-snug text-muted-foreground">{{ k === 'customers' ? 'Upload a sheet with one row per customer; everyone gets their own Highreel and link.' : 'One Highreel about your year, to post on your social media.' }}</span>
            </Label>
          </RadioGroup>
          <div class="grid grid-cols-[1fr_104px] gap-3">
            <div class="flex flex-col gap-2">
              <Label for="nc-name" class="text-[12px]">Name</Label>
              <Input id="nc-name" v-model="name" maxlength="80" required class="h-9" @input="touched = true" />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="nc-year" class="text-[12px]">Year</Label>
              <Input id="nc-year" v-model="year" type="number" min="2000" max="2100" required class="h-9 font-mono" />
            </div>
          </div>
        </div>

        <!-- 2. The business type (customers only) -->
        <RadioGroup v-else-if="step === 'type'" v-model="starterKey" class="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Business type" data-step-body="type">
          <Label
            v-for="s in starters"
            :key="s.key"
            :for="`nr-st-${s.key}`"
            class="choice relative gap-3 p-3 pr-9 font-normal"
            :data-checked="starterKey === s.key"
            :data-starter="s.key"
          >
            <span class="flex min-w-0 flex-col gap-0.5">
              <span class="text-[14px] font-semibold">{{ s.label }}</span>
              <span class="text-[12px] leading-snug text-muted-foreground">{{ s.description }}</span>
            </span>
            <RadioGroupItem :id="`nr-st-${s.key}`" :value="s.key" class="absolute top-3 right-3" />
          </Label>
        </RadioGroup>

        <!-- 3. The look -->
        <div v-else data-step-body="look" data-testid="new-look">
          <LookPicker :model-value="look" @update:model-value="pickLook" />
        </div>
        </div>

        <DialogFooter class="shrink-0 max-sm:flex-row max-sm:justify-end">
          <Button type="button" variant="outline" size="sm" data-testid="wizard-back" @click="back">{{ at === 0 ? 'Cancel' : 'Back' }}</Button>
          <Button type="submit" size="sm" :disabled="saving || !name.trim()" data-testid="wizard-next">{{ last ? (saving ? 'Creating…' : 'Create') : 'Continue' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* A choice card: a label holding its radio (shadcn RadioGroup), outlined when picked. */
.choice {
  display: flex;
  border-radius: 16px;
  border: 1px solid var(--border);
  text-align: left;
  line-height: 1.3;
  cursor: pointer;
  transition: background-color 120ms ease, box-shadow 120ms ease;
}
.choice:hover { background: var(--muted); }
.choice[data-checked='true'] {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}
</style>
