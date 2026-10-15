<script setup lang="ts">
// Pick a Highreel's look (SPEC M2.17): a design, then one of its colourways.
// Colour belongs to the design (owner, 2026-10-15), so there's no colour of
// the business's own and no free colour picker: each design offers its own
// colours. Used by New Highreel (cards with each design's line) and Design's
// rail (`compact`: a row per design). Switching design keeps the colourway
// when the new design has it.
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { type Design, designs, getDesign, type Look } from '#shared/templates/designs'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const look = defineModel<Look>({ required: true })
const id = useId()

const design = computed(() => getDesign(look.value.design))
const colorway = computed(() => design.value.colorways.find(c => c.key === look.value.colorway) ?? design.value.colorways[0]!)
/** The colourway a design would start in from here: the current one if it has it. */
const colorwayIn = (d: Design) => (d.colorways.some(c => c.key === look.value.colorway) ? look.value.colorway : d.colorways[0]!.key)

function pickDesign(key: unknown) {
  if (typeof key === 'string' && key !== look.value.design)
    look.value = { design: key, colorway: colorwayIn(getDesign(key)) }
}
function pickColorway(key: unknown) {
  if (typeof key === 'string' && key)
    look.value = { design: look.value.design, colorway: key }
}
</script>

<template>
  <div class="flex flex-col" :class="compact ? 'gap-2.5' : 'gap-6'">
    <div class="flex flex-col gap-2">
    <p v-if="!compact" class="text-[12px] font-medium">Design</p>
    <RadioGroup
      :model-value="look.design"
      :class="compact ? 'flex flex-col gap-1' : 'grid gap-2 sm:grid-cols-2'"
      aria-label="Design"
      data-testid="designs"
      @update:model-value="pickDesign"
    >
      <Label
        v-for="d in designs"
        :key="d.key"
        :for="`${id}-${d.key}`"
        class="design relative font-normal"
        :class="compact ? 'gap-2.5 bg-background px-2 py-1.5 pr-8' : 'gap-3.5 p-3 pr-9'"
        :data-checked="look.design === d.key"
        :data-design="d.key"
      >
        <DesignSwatch :look="{ design: d.key, colorway: colorwayIn(d) }" :class="compact ? 'w-4' : 'w-10'" />
        <span class="flex min-w-0 flex-col gap-0.5">
          <span class="text-[13.5px] font-semibold">{{ d.label }}</span>
          <span v-if="!compact" class="text-[12px] leading-snug text-muted-foreground">{{ d.description }}</span>
        </span>
        <RadioGroupItem :id="`${id}-${d.key}`" :value="d.key" class="absolute" :class="compact ? 'top-1/2 right-2.5 -translate-y-1/2' : 'top-3 right-3'" />
      </Label>
    </RadioGroup>
    </div>

    <div class="flex flex-col" :class="compact ? 'gap-1.5' : 'gap-2'">
      <p class="text-[12px]" :class="compact ? 'text-muted-foreground' : 'font-medium'">
        Colors · <span class="font-medium" :class="compact ? 'text-foreground' : 'text-muted-foreground'" data-testid="colorway-name">{{ colorway.label }}</span>
      </p>
      <ToggleGroup
        type="single"
        :model-value="colorway.key"
        :spacing="2"
        class="flex flex-wrap justify-start gap-1.5"
        :aria-label="`${design.label} colors`"
        data-testid="colorways"
        @update:model-value="pickColorway"
      >
        <ToggleGroupItem
          v-for="c in design.colorways"
          :key="c.key"
          :value="c.key"
          :aria-label="c.label"
          :title="c.label"
          :data-colorway="c.key"
          class="rounded-full p-0 ring-offset-2 ring-offset-background transition-transform hover:scale-110 data-[state=on]:ring-2 data-[state=on]:ring-foreground"
          :class="compact ? 'size-6 min-w-6' : 'size-7 min-w-7'"
          :style="{ background: c.accent }"
        />
      </ToggleGroup>
    </div>
  </div>
</template>

<style scoped>
/* A choice: a label holding its radio (shadcn RadioGroup), outlined when picked. */
.design {
  display: flex;
  align-items: center;
  border-radius: 14px;
  border: 1px solid var(--border);
  text-align: left;
  line-height: 1.3;
  cursor: pointer;
  transition: background-color 120ms ease, box-shadow 120ms ease;
}
.design:hover { background: var(--muted); }
.design[data-checked='true'] {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
}
</style>
