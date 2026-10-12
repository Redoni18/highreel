<script setup lang="ts">
// New recap (SPEC M2b, M2.5 P3/P4): a recap for each customer, started from
// a business-type template (shared/templates/starters.ts: its sheet, wording,
// theme and colour), or one recap about the business's own year. Used by the
// home and the campaign switcher; the caller creates it.
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { CampaignKind } from '#shared/types/recap'
import { templates } from '#shared/templates'
import { getStarter, starters } from '#shared/templates/starters'

interface NewRecapInput { name: string, year: number, template_key: string, starter?: string }

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

const defaultName = (k: CampaignKind, y: number) => (k === 'business' ? `Our ${y}` : `${y} highlight reels`)
// Keep the suggested name in step with kind and year until it's edited.
const touched = ref(false)
watch([kind, year], () => {
  if (!touched.value)
    name.value = defaultName(kind.value, Number(year.value))
})
watch(open, (v) => {
  if (v) {
    kind.value = businessTemplate ? props.kind : 'customers'
    year.value = new Date().getFullYear()
    name.value = defaultName(kind.value, year.value)
    starterKey.value = starters[0]!.key
    touched.value = false
  }
})

async function submit() {
  saving.value = true
  const starter = getStarter(starterKey.value)!
  const input: NewRecapInput = kind.value === 'business' && businessTemplate
    ? { name: name.value.trim(), year: Number(year.value), template_key: businessTemplate.key }
    : { name: name.value.trim(), year: Number(year.value), template_key: starter.template, starter: starter.key }
  const ok = await props.create(input)
  saving.value = false
  if (ok)
    open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-2xl">
      <form class="flex min-h-0 flex-col gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>New highlight reel</DialogTitle>
          <DialogDescription>Start from a template for your kind of business. You can change the colour and every line in Brand.</DialogDescription>
        </DialogHeader>
        <RadioGroup v-if="businessTemplate" v-model="kind" class="grid grid-cols-2 gap-1.5" aria-label="What kind of highlight reel">
          <Label
            v-for="k in (['customers', 'business'] as const)"
            :key="k"
            :for="`nr-kind-${k}`"
            class="choice flex-col items-start gap-0.5 p-3 text-[12px] font-normal"
            :data-checked="kind === k"
          >
            <span class="flex w-full items-center justify-between gap-2 text-[14px] font-semibold">{{ k === 'customers' ? 'For each customer' : 'Your business year' }}<RadioGroupItem :id="`nr-kind-${k}`" :value="k" /></span>
            <span class="leading-snug text-muted-foreground">{{ k === 'customers' ? 'Upload a sheet; everyone gets their own link.' : 'One highlight reel for your social media.' }}</span>
          </Label>
        </RadioGroup>

        <div v-if="kind === 'customers'" class="flex min-h-0 flex-col gap-2">
          <p id="nc-templates" class="text-[12px] font-medium">Template</p>
          <RadioGroup v-model="starterKey" class="grid max-h-[min(46vh,420px)] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2" aria-labelledby="nc-templates">
            <Label
              v-for="s in starters"
              :key="s.key"
              :for="`nr-st-${s.key}`"
              class="choice relative gap-3 p-2 pr-8 font-normal"
              :data-checked="starterKey === s.key"
              :data-starter="s.key"
            >
              <TemplateSwatch :starter="s" class="w-9" />
              <span class="flex min-w-0 flex-col gap-0.5">
                <span class="text-[14px] font-semibold">{{ s.label }}</span>
                <span class="text-[12px] leading-snug text-muted-foreground">{{ s.description }}</span>
              </span>
              <RadioGroupItem :id="`nr-st-${s.key}`" :value="s.key" class="absolute top-2.5 right-2.5" />
            </Label>
          </RadioGroup>
        </div>
        <p v-else-if="businessTemplate" class="text-[12px] text-muted-foreground">{{ businessTemplate.description }}</p>

        <div class="grid grid-cols-[1fr_96px] gap-3">
          <div class="flex flex-col gap-1.5">
            <Label for="nc-name" class="text-[12px]">Name</Label>
            <Input id="nc-name" v-model="name" maxlength="80" required class="h-8" @input="touched = true" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="nc-year" class="text-[12px]">Year</Label>
            <Input id="nc-year" v-model="year" type="number" min="2000" max="2100" required class="h-8 font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" @click="open = false">Cancel</Button>
          <Button type="submit" size="sm" :disabled="saving || !name.trim()">{{ saving ? 'Creating…' : 'Create' }}</Button>
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
