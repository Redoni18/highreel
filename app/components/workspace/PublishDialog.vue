<script setup lang="ts">
// "Publish 195 recaps? 5 rows need fixing and will be skipped." (SPEC §6.3)
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { default: false })
const ws = useWorkspace()
const n = computed(() => ws.counts.value)
const fmt = (x: number) => x.toLocaleString('en-US')

const title = computed(() => ws.isPublished.value
  ? `Publish ${fmt(n.value.ready)} new ${n.value.ready === 1 ? 'Highreel' : 'Highreels'}?`
  : `Publish ${fmt(n.value.ready)} ${n.value.ready === 1 ? 'Highreel' : 'Highreels'}?`)

async function confirm() {
  open.value = false
  await ws.publish()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="flex flex-col gap-1.5">
          <span>Each Highreel gets a private link, ready to send from Share: by email from your own account, on WhatsApp or as a links file.</span>
          <span v-if="n.errors" class="text-destructive">{{ fmt(n.errors) }} {{ n.errors === 1 ? 'row needs' : 'rows need' }} fixing and will be skipped.</span>
          <span v-if="n.published">{{ fmt(n.published) }} published {{ n.published === 1 ? 'link stays' : 'links stay' }} the same; their ranks are refreshed.</span>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" size="sm" @click="open = false">Cancel</Button>
        <Button size="sm" @click="confirm">Publish</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
