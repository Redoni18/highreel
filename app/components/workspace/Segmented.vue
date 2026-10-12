<script setup lang="ts" generic="T extends string">
// A pill-shaped segmented control (SPEC §6.4, M2.10): shadcn's ToggleGroup,
// single choice, that can't be switched off (clicking the picked one keeps
// it). Each option's content can come from the default slot.
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

withDefaults(defineProps<{
  options: Array<{ value: T, label: string }>
  /** names the group for screen readers */
  label: string
  size?: 'sm' | 'default'
  /** stretch the options across the width */
  block?: boolean
}>(), { size: 'sm', block: false })
const model = defineModel<T>({ required: true })

function pick(v: unknown) {
  if (typeof v === 'string' && v)
    model.value = v as T
}
</script>

<template>
  <ToggleGroup
    type="single"
    :model-value="model"
    :aria-label="label"
    :spacing="2"
    :size="size"
    class="segmented"
    :class="{ 'segmented-block': block }"
    @update:model-value="pick"
  >
    <ToggleGroupItem
      v-for="o in options"
      :key="o.value"
      :value="o.value"
      :data-value="o.value"
      class="gap-[7px] rounded-full! px-3 font-medium text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04)]"
      :class="{ 'flex-1': block }"
    >
      <slot :option="o">{{ o.label }}</slot>
    </ToggleGroupItem>
  </ToggleGroup>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 9999px;
  background: var(--muted);
}
.segmented-block { display: flex; width: 100%; }
</style>
