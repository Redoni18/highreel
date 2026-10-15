<script setup lang="ts">
// An (i) next to an option that says what it does (SPEC M2.16): a shadcn
// Popover, opened by a click (or Enter), with the words from
// app/data/designHelp.ts. A slot adds a line about the person in the preview.
// Always type="button": it sits inside Design's form.
import { Info } from '@lucide/vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HELP, type HelpKey } from '~/data/designHelp'

const props = defineProps<{
  topic: HelpKey
  /** a title for this place when the topic's own doesn't fit ("Founder note") */
  title?: string
}>()
const help = computed(() => HELP[props.topic])
const heading = computed(() => props.title ?? help.value.title)
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <!-- Named apart from the field it sits by, so a label finds the field alone. -->
      <button type="button" class="info" aria-label="What this does" :data-info="topic">
        <Info class="size-3.5" aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" :side-offset="6" class="w-[min(340px,calc(100vw-32px))] gap-2.5 rounded-[16px] p-4 text-[13px] leading-[1.5]" :data-info-panel="topic">
      <p class="text-[14px] font-semibold">{{ heading }}</p>
      <p v-for="(p, i) in help.body" :key="i" class="text-muted-foreground">{{ p }}</p>
      <dl v-if="help.options" class="flex flex-col gap-2">
        <div v-for="o in help.options" :key="o.name" class="rounded-[10px] bg-subtle px-3 py-2">
          <dt class="font-medium">{{ o.name }}</dt>
          <dd class="text-muted-foreground">{{ o.text }}</dd>
        </div>
      </dl>
      <p v-if="help.foot" class="text-muted-foreground">{{ help.foot }}</p>
      <p v-if="$slots.default" class="border-t pt-2.5"><slot /></p>
    </PopoverContent>
  </Popover>
</template>

<style scoped>
.info {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  color: color-mix(in oklab, var(--muted-foreground) 80%, transparent);
  transition: background-color 120ms ease, color 120ms ease;
}
.info:hover,
.info[data-state='open'] {
  background: var(--muted);
  color: var(--foreground);
}
.info:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}
</style>
