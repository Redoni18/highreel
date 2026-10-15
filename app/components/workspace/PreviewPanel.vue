<script setup lang="ts">
// Live recap preview for the selected row (SPEC §6.1). Unpublished data and
// unsaved brand edits are allowed here, never on the public page.
import { resolveLook } from '#shared/templates/designs'
import { ChevronLeft, ChevronRight, ExternalLink, Pause, Play, X } from '@lucide/vue'
import { useElementSize } from '@vueuse/core'
import RecapPlayer from '~/components/recap/RecapPlayer.vue'

const ws = useWorkspace()

const row = computed(() => ws.selectedRow.value ?? ws.visibleRows.value[0] ?? null)
const payload = computed(() => ws.previewPayload.value)

const player = ref<InstanceType<typeof RecapPlayer> | null>(null)

// Fit the iPhone (the landing's frame, 100 : 208.7) into the space left.
const stage = ref<HTMLElement | null>(null)
const { width: stageW, height: stageH } = useElementSize(stage)
const phoneWidth = computed(() => `${Math.floor(Math.max(0, Math.min(stageW.value - 48, (stageH.value - 32) * 0.479)))}px`)
const ink = computed(() => player.value?.tone?.fg ?? '#FFFFFF')
// Like the landing's example stage, the phone sits on the business's colour
// (a faint tint here, next to the grid); unsaved Brand edits recolour it.
const accent = computed(() => (payload.value ? resolveLook(payload.value.settings.look).accent : 'transparent'))

// Resize by dragging the left edge.
function startResize(e: PointerEvent) {
  const startX = e.clientX
  const startW = ws.previewWidth.value
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  const onMove = (ev: PointerEvent) => {
    ws.previewWidth.value = Math.max(300, Math.min(620, startW + startX - ev.clientX))
  }
  const onUp = () => {
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
  }
  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
}
</script>

<template>
  <aside class="relative flex shrink-0 flex-col border-l bg-subtle" :style="{ width: `${ws.previewWidth.value}px` }" aria-label="Highreel preview">
    <div
      class="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-foreground/10"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize preview"
      @pointerdown.prevent="startResize"
    />
    <div class="flex h-10 shrink-0 items-center gap-2 border-b bg-background px-3 text-[13px]">
      <span class="font-semibold">Preview</span>
      <template v-if="row">
        <span v-if="!ws.isBusiness.value" class="truncate text-muted-foreground">{{ row.raw.first_name || '(no name)' }} · row {{ row.row_index + 1 }}</span>
        <a
          v-if="row.token"
          :href="`/r/${row.token}`"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          title="Open the published Highreel"
        ><ExternalLink class="size-3.5" /></a>
      </template>
      <button type="button" class="ml-auto grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Hide preview (P)" title="Hide preview (P)" @click="ws.previewOpen.value = false">
        <X class="size-3.5" />
      </button>
    </div>

    <div ref="stage" class="stage relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" :style="{ '--accent': accent }">
      <PhoneFrame v-if="payload" class="phone" :style="{ width: phoneWidth }" :ink="ink">
        <RecapPlayer ref="player" :payload="payload" mode="preview" :autoplay="false" />
      </PhoneFrame>
      <p v-else class="text-[13px] text-muted-foreground">Select a row to preview it.</p>
    </div>

    <div v-if="payload && player" class="flex h-11 shrink-0 items-center justify-center gap-1 border-t bg-background text-[12px]">
      <button type="button" class="grid size-8 place-items-center rounded-full hover:bg-muted disabled:opacity-40" aria-label="Previous slide" :disabled="player.index === 0" @click="player.prev()">
        <ChevronLeft class="size-4" />
      </button>
      <span class="w-24 text-center font-mono text-[11px] text-muted-foreground tabular-nums">slide {{ player.index + 1 }}/{{ player.count }}</span>
      <button type="button" class="grid size-8 place-items-center rounded-full hover:bg-muted disabled:opacity-40" aria-label="Next slide" :disabled="player.index >= player.count - 1" @click="player.next()">
        <ChevronRight class="size-4" />
      </button>
      <button type="button" class="ml-2 grid size-8 place-items-center rounded-full bg-foreground text-background hover:bg-foreground/85" :aria-label="player.playing ? 'Pause' : 'Play'" @click="player.playing = !player.playing">
        <Pause v-if="player.playing" class="size-3.5" />
        <Play v-else class="size-3.5" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.stage {
  background: color-mix(in oklab, var(--accent) 10%, var(--subtle));
  transition: background-color 300ms ease;
}
.phone { font-family: var(--font-sans); }
</style>
