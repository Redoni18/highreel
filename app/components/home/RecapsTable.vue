<script setup lang="ts">
// The year's recaps as an Airtable-style table (SPEC M2.5 P3): one row per
// campaign, counts in mono, a row opens it, the row menu duplicates or deletes.
import { Copy, Ellipsis, SquareArrowOutUpRight, Trash2 } from '@lucide/vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { HomeCampaign } from '#shared/types/recap'
import { getTemplate } from '#shared/templates'
import { timeAgo } from '#shared/utils/home'

defineProps<{ campaigns: HomeCampaign[] }>()
const emit = defineEmits<{ open: [id: string], duplicate: [c: HomeCampaign], remove: [c: HomeCampaign] }>()

const fmt = (x: number) => x.toLocaleString('en-US')
const pct = (c: HomeCampaign) => (c.published ? `${Math.round((c.opened / c.published) * 100)}%` : '–')

function onRowClick(e: MouseEvent, id: string) {
  if (!(e.target as HTMLElement).closest('button, a, [role="menu"]'))
    emit('open', id)
}
</script>

<template>
  <TableScroll>
    <table class="w-full min-w-[920px] border-collapse text-left text-[14px]">
      <thead class="bg-subtle text-[12px] text-muted-foreground">
        <tr class="h-9 border-b">
          <th class="w-[24%] px-4 font-medium">Name</th>
          <th class="px-2 font-medium">Kind</th>
          <th class="px-2 font-medium">Template</th>
          <th class="px-2 font-medium">Status</th>
          <th class="px-2 text-right font-medium">Rows</th>
          <th class="px-2 text-right font-medium">Published</th>
          <th class="px-2 text-right font-medium">Opened</th>
          <th class="px-2 text-right font-medium">Saved</th>
          <th class="px-2 text-right font-medium">Shared</th>
          <th class="px-2 text-right font-medium">Clicks</th>
          <th class="px-2 font-medium">Updated</th>
          <th class="w-9" aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="c in campaigns"
          :key="c.id"
          class="h-11 cursor-pointer border-b last:border-0 hover:bg-subtle"
          :data-campaign="c.id"
          @click="onRowClick($event, c.id)"
        >
          <td class="max-w-[320px] px-4">
            <NuxtLink :to="`/app/c/${c.id}`" class="block truncate font-medium hover:underline" :title="c.name">{{ c.name }}</NuxtLink>
          </td>
          <td class="px-2 whitespace-nowrap text-muted-foreground">{{ c.kind === 'business' ? 'your business' : 'customers' }}</td>
          <td class="px-2 whitespace-nowrap text-muted-foreground">{{ getTemplate(c.template_key).label }}</td>
          <td class="px-2 whitespace-nowrap">
            <span
              class="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium"
              :class="c.status === 'published' ? 'bg-ok/12 text-ok-text' : 'bg-muted text-muted-foreground'"
            >
              <span class="size-1.5 rounded-full" :class="c.status === 'published' ? 'bg-ok' : 'bg-muted-foreground/50'" aria-hidden="true" />
              {{ c.status }}
            </span>
          </td>
          <td class="num">{{ fmt(c.row_count) }}</td>
          <td class="num">{{ fmt(c.published) }}</td>
          <td class="num" :title="c.kind === 'business' ? 'Views' : `${fmt(c.opened)} of ${fmt(c.published)} opened`">{{ c.kind === 'business' ? `${fmt(c.views)} views` : pct(c) }}</td>
          <td class="num">{{ c.kind === 'business' ? '–' : fmt(c.saved) }}</td>
          <td class="num">{{ c.kind === 'business' ? '–' : fmt(c.shared) }}</td>
          <td class="num">{{ c.kind === 'business' ? '–' : fmt(c.clicked) }}</td>
          <td class="px-2 whitespace-nowrap text-muted-foreground" :title="new Date(c.updated_at).toLocaleString()">{{ timeAgo(c.updated_at) }}</td>
          <td class="px-1">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button type="button" class="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" :aria-label="`Actions for ${c.name}`">
                  <Ellipsis class="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-44 text-[13px]">
                <DropdownMenuItem @select="emit('open', c.id)">
                  <SquareArrowOutUpRight /> Open
                </DropdownMenuItem>
                <DropdownMenuItem @select="emit('duplicate', c)">
                  <Copy /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="text-destructive focus:text-destructive" @select="emit('remove', c)">
                  <Trash2 class="text-destructive" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
      </tbody>
    </table>
  </TableScroll>
</template>

<style scoped>
.num {
  padding: 0 8px;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
