<script setup lang="ts">
// A table's rounded box (the home's Highreels, the admin lists). It scrolls
// sideways without a scrollbar (owner, 2026-10-13; the sheet keeps its own).
// A mouse wheel only scrolls up and down, so with the scrollbar gone a mouse
// had no way to reach the hidden columns: where columns are hidden the edge
// fades and a round arrow scrolls the table, and it follows down a long
// table. A trackpad, shift + wheel and touch move it as before. A column
// pinned to the right edge (`.pinned` in the header) stays outside the fade.
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const FADE = 40
const box = ref<HTMLElement>()
const left = ref(false)
const right = ref(false)
const pin = ref(0)

function measure() {
  const el = box.value
  if (!el)
    return
  left.value = el.scrollLeft > 1
  right.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
  pin.value = el.querySelector<HTMLElement>('thead .pinned')?.offsetWidth ?? 0
}

function step(dir: 1 | -1) {
  const el = box.value
  if (!el)
    return
  const instant = matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollBy({ left: dir * Math.max(160, (el.clientWidth - pin.value) * 0.75), behavior: instant ? 'instant' : 'smooth' })
}

// The content fades out at an edge with more behind it (the box's border stays).
const mask = computed(() => {
  if (!left.value && !right.value)
    return undefined
  const stops = [left.value ? `transparent, #000 ${FADE}px` : '#000']
  if (right.value) {
    stops.push(`#000 calc(100% - ${pin.value + FADE}px)`, `transparent calc(100% - ${pin.value}px)`)
    if (pin.value)
      stops.push(`#000 calc(100% - ${pin.value}px)`)
  }
  else {
    stops.push('#000')
  }
  const image = `linear-gradient(to right, ${stops.join(', ')})`
  return { maskImage: image, WebkitMaskImage: image }
})

let resize: ResizeObserver | undefined
onMounted(() => {
  measure()
  resize = new ResizeObserver(measure)
  resize.observe(box.value!)
  // The table itself: rows, columns or a search change its width.
  for (const child of box.value!.children)
    resize.observe(child)
})
onBeforeUnmount(() => resize?.disconnect())
</script>

<template>
  <!-- The arrows' columns run the table's height: an arrow sits in the header
       row and, on a long table, stays near the top of the window as it goes by. -->
  <div class="relative rounded-2xl border" data-table-scroll>
    <div ref="box" class="scrollbar-none relative overflow-x-auto rounded-[15px]" :style="mask" @scroll.passive="measure">
      <slot />
    </div>
    <div v-if="left" class="pointer-events-none absolute inset-y-0 left-1.5 w-7">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="outline" size="icon" class="pointer-events-auto sticky top-2 mt-1 size-7 rounded-full bg-background shadow-sm dark:bg-background dark:hover:bg-muted" aria-label="Scroll the table left" data-scroll="left" @click="step(-1)">
            <ChevronLeft class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Back</TooltipContent>
      </Tooltip>
    </div>
    <div v-if="right" class="pointer-events-none absolute inset-y-0 w-7" :style="{ right: `${pin + 6}px` }">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="outline" size="icon" class="pointer-events-auto sticky top-2 mt-1 size-7 rounded-full bg-background shadow-sm dark:bg-background dark:hover:bg-muted" aria-label="Scroll the table right" data-scroll="right" @click="step(1)">
            <ChevronRight class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>More columns</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
