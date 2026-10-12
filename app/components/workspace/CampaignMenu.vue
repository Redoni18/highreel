<script setup lang="ts">
// Recap switcher next to the campaign name (SPEC M2b).
import { Check, ChevronDown, Plus, Trash2 } from '@lucide/vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const ws = useWorkspace()
const newOpen = ref(false)
const deleteOpen = ref(false)
const fmt = (x: number) => x.toLocaleString('en-US')

const deleteText = computed(() => {
  const c = ws.campaign.value
  const n = ws.counts.value
  if (!c)
    return ''
  const rows = n.total ? `Its ${fmt(n.total)} rows go with it` : 'It has no rows'
  const links = n.published ? `, and ${fmt(n.published)} published links stop working` : ''
  return `${rows}${links}. This can't be undone.`
})
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button type="button" class="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Switch campaign">
        <ChevronDown class="size-3.5" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-72 text-[13px]">
      <DropdownMenuLabel class="text-[11px] font-medium text-muted-foreground">Highlight reels</DropdownMenuLabel>
      <DropdownMenuItem v-for="c in ws.campaigns.value" :key="c.id" class="gap-2" @select="ws.switchCampaign(c.id)">
        <Check class="size-3.5" :class="c.id === ws.campaign.value?.id ? '' : 'invisible'" />
        <span class="min-w-0 flex-1 truncate">{{ c.name }}</span>
        <span class="font-mono text-[11px] text-muted-foreground tabular-nums">{{ fmt(c.row_count) }}</span>
        <span class="inline-flex w-20 items-center justify-end gap-1.5 text-[12px] text-muted-foreground"><span class="size-1.5 rounded-full" :class="c.status === 'published' ? 'bg-ok' : 'bg-muted-foreground/40'" aria-hidden="true" />{{ c.status }}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="newOpen = true">
        <Plus /> New highlight reel
      </DropdownMenuItem>
      <DropdownMenuItem class="text-destructive focus:text-destructive" @select="deleteOpen = true">
        <Trash2 class="text-destructive" /> Delete this highlight reel
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <NewRecapDialog v-model:open="newOpen" :create="ws.createCampaign" />
  <ConfirmDialog
    v-model:open="deleteOpen"
    :title="`Delete “${ws.campaign.value?.name}”?`"
    :description="deleteText"
    confirm-label="Delete highlight reel"
    @confirm="ws.deleteCampaign()"
  />
</template>
