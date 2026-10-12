<script setup lang="ts">
// One grid cell's display: numbers right-aligned in mono, ids and dates in
// mono, text in sans. Errors and warnings show as a faint tint + bottom rule.
import type { TemplateColumn } from '#shared/templates/types'

const props = defineProps<{
  value: string
  column: TemplateColumn
  error?: string
  warning?: string
}>()

const numeric = computed(() => props.column.type === 'int' || props.column.type === 'decimal')
const mono = computed(() => numeric.value || props.column.type === 'date' || props.column.key === 'customer_id')
</script>

<template>
  <div
    class="flex h-full w-full items-center overflow-hidden px-2"
    :class="[
      numeric ? 'justify-end' : '',
      mono ? 'font-mono text-[12px] tabular-nums' : '',
      error ? 'cell-error' : warning ? 'cell-warning' : '',
    ]"
    :data-tip="error || warning || undefined"
    :data-tip-kind="error ? 'error' : warning ? 'warning' : undefined"
  >
    <span class="truncate">{{ value }}</span>
  </div>
</template>
