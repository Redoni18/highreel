<script setup lang="ts">
// A recap (SPEC §6, M2.6): the top bar with the three steps as tabs, and the
// tab underneath (pages/app/c/[id]/: Sheet, Design, Share). This parent owns
// the workspace store, so rows load once and unsaved edits survive switching
// tabs. Client-only (see routeRules).
import { Loader2 } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// One page instance across campaigns: switching replaces the URL and the
// store loads the other campaign, without remounting.
definePageMeta({ key: 'workspace' })

const ws = provideWorkspace()
const route = useRoute()
useHead({ title: () => (ws.campaign.value?.name ? `${ws.campaign.value.name} · Highreel` : 'Highreel') })
const publishOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

ws.setFilePicker(() => fileInput.value?.click())
onMounted(() => ws.load())
// Back and forward between campaigns.
watch(() => route.params.id, (id) => {
  if (typeof id === 'string' && ws.campaign.value && id !== ws.campaign.value.id)
    ws.switchCampaign(id)
})

// Unsaved Design edits (SPEC M2.11) survive switching tabs, not leaving the
// recap: going to another recap, the home or Your brand asks first, and so
// does closing or reloading the page (the browser's own prompt).
const leaving = ref<string | null>(null)
const leavingSave = ref(false)
let letGo = false
function holdIfUnsaved(to: { path: string, fullPath: string }) {
  // Signing out (or a session that ended, useApi) goes straight to sign-in: nothing could be saved after it.
  if (letGo || !ws.designDirty.value || to.path === '/login')
    return true
  leaving.value = to.fullPath
  return false
}
onBeforeRouteLeave(to => holdIfUnsaved(to))
onBeforeRouteUpdate(to => (to.params.id === route.params.id ? true : holdIfUnsaved(to)))
useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (ws.designDirty.value)
    e.preventDefault()
})
async function leave(save: boolean) {
  const to = leaving.value
  if (!to)
    return
  if (save) {
    leavingSave.value = true
    const ok = await ws.saveDesign()
    leavingSave.value = false
    if (!ok)
      return
  }
  else {
    ws.draft.value = null
  }
  leaving.value = null
  letGo = true
  try {
    await navigateTo(to)
  }
  finally {
    letGo = false
  }
}

function onFileChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file)
    ws.handleFile(file)
}
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden">
    <DemoBanner v-if="ws.anonymous.value" />
    <TopBar @publish="publishOpen = true" />

    <div v-if="ws.loading.value" class="flex flex-1 items-center justify-center text-muted-foreground">
      <Loader2 class="size-4 animate-spin" />
    </div>
    <div v-else-if="ws.loadError.value" class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p class="text-[18px] font-semibold">Couldn't open this Highreel</p>
      <p class="max-w-md text-[14px] text-muted-foreground">{{ ws.loadError.value }}</p>
      <div class="flex gap-2">
        <Button variant="outline" as-child><NuxtLink to="/app">Back to your Highreels</NuxtLink></Button>
        <Button variant="ghost" @click="ws.load()">Try again</Button>
      </div>
    </div>
    <NuxtPage v-else-if="ws.campaign.value" />

    <PublishDialog v-model:open="publishOpen" />
    <ImportDialog />
    <MappingDialog />
    <Dialog :open="!!leaving" @update:open="v => { if (!v && !leavingSave) leaving = null }">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Save your design changes?</DialogTitle>
          <DialogDescription>You changed how this Highreel looks or what it says in Design. Save them before you go, or leave them out.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" :disabled="leavingSave" @click="leaving = null">Keep editing</Button>
          <Button variant="ghost" size="sm" :disabled="leavingSave" @click="leave(false)">Discard changes</Button>
          <Button size="sm" :disabled="leavingSave" @click="leave(true)">{{ leavingSave ? 'Saving…' : 'Save and leave' }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <input ref="fileInput" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hidden" data-testid="file-input" @change="onFileChosen">
  </div>
</template>
