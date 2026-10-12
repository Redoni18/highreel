<script setup lang="ts">
// Confirm before an upload replaces rows that are already in the grid.
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const ws = useWorkspace()
const sheet = computed(() => ws.pendingImport.value)
const open = computed({
  get: () => !!sheet.value,
  set: (v) => {
    if (!v)
      ws.pendingImport.value = null
  },
})
const fmt = (x: number) => x.toLocaleString('en-US')
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Replace {{ fmt(ws.counts.value.total) }} rows?</DialogTitle>
        <DialogDescription>
          <span class="font-mono">{{ sheet?.name }}</span> has {{ fmt(sheet?.rows.length ?? 0) }} rows. Importing it replaces everything in the grid, including your edits.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" size="sm" @click="open = false">Cancel</Button>
        <Button size="sm" @click="ws.confirmImport()">Replace rows</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
