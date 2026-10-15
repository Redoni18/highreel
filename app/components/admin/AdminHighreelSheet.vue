<script setup lang="ts">
// One Highreel's numbers, in a sheet on its owner's page (SPEC M2.16): the
// table there keeps a few columns, and a row opens everything else here
// (its sheet, how it went out, what customers did, payment, dates). Counts
// only, like the rest of the admin pages.
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { AdminUserHighreel } from '#shared/types/admin'
import { type FigureGroup, formatMoney, highreelFigures } from '#shared/utils/admin'
import { getTemplate } from '#shared/templates'

const props = defineProps<{ highreel: AdminUserHighreel | null }>()
const open = defineModel<boolean>('open', { default: false })

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–')
const groups = computed<FigureGroup[]>(() => {
  const h = props.highreel
  if (!h)
    return []
  const paid = h.kind === 'business'
    ? 'free (their own)'
    : h.payments ? formatMoney(h.paid) : h.status === 'published' ? 'not paid' : '–'
  return [
    ...highreelFigures(h),
    {
      title: 'Payment and dates',
      figures: [
        { label: 'Paid', value: paid, flag: h.kind === 'customers' && h.status === 'published' && !h.payments },
        { label: 'Made', value: day(h.created_at) },
        { label: 'Published', value: day(h.published_at) },
      ],
    },
  ]
})
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full gap-0 overflow-y-auto sm:max-w-md" data-testid="highreel-sheet">
      <SheetHeader v-if="highreel" class="gap-1 px-6 pt-6 pb-4">
        <SheetTitle class="pr-8 text-[20px] leading-tight font-semibold tracking-[-0.015em]">{{ highreel.name }}</SheetTitle>
        <SheetDescription class="flex flex-wrap items-center gap-x-2 text-[13px]">
          <span>{{ getTemplate(highreel.template_key).label }} · {{ highreel.year }}</span>
          <span
            class="inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium"
            :class="highreel.status === 'published' ? 'bg-ok/12 text-ok-text' : 'bg-muted text-muted-foreground'"
          >{{ highreel.status }}</span>
        </SheetDescription>
      </SheetHeader>
      <div class="flex flex-col gap-5 px-6 pb-8">
        <section v-for="g in groups" :key="g.title" class="flex flex-col gap-1" :data-figures="g.title">
          <h3 class="text-[13px] font-medium text-muted-foreground">{{ g.title }}</h3>
          <ul class="flex flex-col text-[14px]">
            <li v-for="f in g.figures" :key="f.label" class="flex h-9 items-center gap-2 border-b border-dashed last:border-0" :data-figure="f.label">
              <span v-if="f.flag" class="size-2 shrink-0 rounded-full bg-[var(--shape-marigold)]" aria-hidden="true" />
              <span class="truncate">{{ f.label }}</span>
              <span v-if="f.detail" class="ml-auto shrink-0 font-mono text-[12px] text-muted-foreground">{{ f.detail }}</span>
              <span class="min-w-[4.5rem] shrink-0 text-right font-mono text-[13px] font-medium tabular-nums" :class="{ 'ml-auto': !f.detail }" data-value>{{ f.value }}</span>
            </li>
          </ul>
        </section>
      </div>
    </SheetContent>
  </Sheet>
</template>
