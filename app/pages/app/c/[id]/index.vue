<script setup lang="ts">
// Sheet, step one of a recap (SPEC §6, M2.6): the data and a live preview,
// nothing else. A business recap shows its form (Content) here instead.
// Drop a file anywhere to import it; ⌘F / Ctrl+F searches, P toggles the preview.
const ws = useWorkspace()
const route = useRoute()
const router = useRouter()
const dragging = ref(false)
let dragDepth = 0

onMounted(async () => {
  // "Try it with sample data" on the home lands here with ?sample=1.
  if (route.query.sample === '1') {
    await router.replace({ query: {} })
    if (!ws.rows.value.length && !ws.isBusiness.value)
      await ws.loadSample()
  }
})

function hasFiles(e: DragEvent) {
  return [...(e.dataTransfer?.types ?? [])].includes('Files')
}
function onDragEnter(e: DragEvent) {
  if (!hasFiles(e) || ws.isBusiness.value)
    return
  dragDepth++
  dragging.value = true
}
function onDragLeave(e: DragEvent) {
  if (!hasFiles(e))
    return
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth)
    dragging.value = false
}
function onDrop(e: DragEvent) {
  dragDepth = 0
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file)
    ws.handleFile(file)
}

function onKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  const typing = target.closest('input, textarea, [contenteditable="true"]')
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && ws.rows.value.length) {
    e.preventDefault()
    const search = document.getElementById('grid-search') as HTMLInputElement | null
    search?.focus()
    search?.select()
    return
  }
  if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'p' && (ws.rows.value.length || ws.isBusiness.value)) {
    e.preventDefault()
    ws.previewOpen.value = !ws.previewOpen.value
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div
    class="flex min-h-0 flex-1"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <section class="flex min-w-0 flex-1 flex-col">
      <BusinessForm v-if="ws.isBusiness.value" class="min-h-0 flex-1" />
      <EmptyState v-else-if="!ws.rows.value.length" class="flex-1" />
      <template v-else>
        <DataGrid class="min-h-0 flex-1" />
        <BottomBar />
      </template>
    </section>

    <PreviewPanel v-if="(ws.isBusiness.value || ws.rows.value.length) && ws.previewOpen.value" />

    <div v-if="dragging" class="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80">
      <div class="rounded-[24px] border-2 border-dashed border-primary/50 bg-background px-10 py-8 text-center">
        <p class="text-[16px] font-semibold">Drop your sheet to import it</p>
        <p class="text-[13px] text-muted-foreground">CSV or Excel (.xlsx), one row per person</p>
      </div>
    </div>
  </div>
</template>
