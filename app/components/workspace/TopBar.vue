<script setup lang="ts">
// Top bar of a recap (SPEC §6.1, M2.6): home, business (→ Your brand) and
// recap names, the three steps as tabs (Sheet · Design · Share, like the
// landing's steps), Publish and the ⋯ menu. Row counts live in the sheet's
// bottom bar.
import { Eraser, Ellipsis, Download, FileDown, LogOut, Moon, Palette, Sun } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { hasErrors } from '#shared/utils/validate'

const ws = useWorkspace()
const route = useRoute()
const emit = defineEmits<{ publish: [] }>()
const colorMode = useColorMode()
const n = computed(() => ws.counts.value)
const fmt = (x: number) => x.toLocaleString('en-US')

const publishLabel = computed(() => {
  if (!ws.isPublished.value)
    return 'Publish'
  return n.value.ready && !ws.isBusiness.value ? `Publish ${fmt(n.value.ready)} new` : 'Published'
})
// A business recap publishes its form straight away (saving it first); a
// sheet asks first in the publish dialog.
const canPublish = computed(() => !ws.busy.value && (ws.isBusiness.value
  ? !ws.isPublished.value && !hasErrors(ws.businessRow.value.errors)
  : n.value.ready > 0))
function onPublish() {
  if (ws.isBusiness.value)
    ws.publishBusiness()
  else
    emit('publish')
}
const clearOpen = ref(false)
const endOpen = ref(false)

// The three steps. A dot says what needs a look: rows to fix, unsaved design, live.
const base = computed(() => `/app/c/${ws.campaign.value?.id ?? route.params.id}`)
const tabs = computed(() => [
  { to: base.value, label: ws.isBusiness.value ? 'Content' : 'Sheet', dot: !ws.isBusiness.value && n.value.errors ? 'error' : null, hint: `${fmt(n.value.errors)} rows need fixing` },
  { to: `${base.value}/design`, label: 'Design', dot: ws.designDirty.value ? 'draft' : null, hint: 'Unsaved changes' },
  { to: `${base.value}/share`, label: 'Share', dot: ws.isPublished.value ? 'live' : null, hint: 'Published' },
])
const here = computed(() => route.path.replace(/\/$/, ''))

function downloadTemplate() {
  ws.downloadSheet()
}
</script>

<template>
  <header class="relative grid h-11 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b px-3">
    <div class="flex min-w-0 items-center gap-1">
      <NuxtLink to="/app" class="wordmark" aria-label="All Highreels" title="All Highreels"><Wordmark /></NuxtLink>
      <span class="mr-1 ml-1.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <template v-if="ws.business.value && ws.campaign.value">
        <NuxtLink to="/app/brand" class="h-8 truncate rounded-full px-2.5 text-[15px] leading-8 font-medium hover:bg-muted" title="Your brand: name, logo, colour">{{ ws.business.value.name }}</NuxtLink>
        <span class="text-muted-foreground/50">/</span>
        <InlineEdit :value="ws.campaign.value.name" label="Campaign name" :max-length="80" @save="v => ws.updateCampaign({ name: v }).then(() => ws.refreshIndex())" />
        <CampaignMenu />
      </template>
    </div>

    <nav v-if="ws.campaign.value" class="flex items-center gap-0.5 rounded-full bg-muted p-0.5" aria-label="Steps">
      <NuxtLink
        v-for="(t, i) in tabs"
        :key="t.label"
        :to="t.to"
        class="step"
        :aria-current="here === t.to ? 'page' : undefined"
      >
        <span class="step-n">{{ i + 1 }}</span>
        {{ t.label }}
        <span v-if="t.dot" class="step-dot" :class="t.dot" :title="t.hint"><span class="sr-only">({{ t.hint }})</span></span>
      </NuxtLink>
    </nav>
    <span v-else />

    <div class="flex items-center justify-end gap-1">
      <Button size="sm" class="px-4 text-[14px]" :disabled="!canPublish" @click="onPublish">
        {{ publishLabel }}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-sm" aria-label="More">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52 text-[13px]">
          <template v-if="!ws.isBusiness.value">
            <DropdownMenuItem @select="downloadTemplate">
              <FileDown /> Download template
            </DropdownMenuItem>
            <DropdownMenuItem :disabled="!n.published" @select="ws.exportLinks()">
              <Download /> Export links CSV
            </DropdownMenuItem>
          </template>
          <DropdownMenuItem @select="navigateTo('/app/brand')">
            <Palette /> Your brand
          </DropdownMenuItem>
          <DropdownMenuItem @select="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'">
            <Sun v-if="colorMode.value === 'dark'" />
            <Moon v-else />
            {{ colorMode.value === 'dark' ? 'Light mode' : 'Dark mode' }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="!ws.isPublished.value && !ws.isBusiness.value" :disabled="!n.total" @select="clearOpen = true">
            <Eraser /> Clear rows
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="ws.anonymous.value ? (endOpen = true) : ws.signOut()">
            <LogOut /> {{ ws.anonymous.value ? 'End demo session' : 'Sign out' }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div v-if="ws.busy.value" class="progress-line" aria-hidden="true" />

    <ConfirmDialog
      v-model:open="clearOpen"
      :title="`Clear ${fmt(n.total)} rows?`"
      description="The campaign stays, with its design. Upload a sheet again afterwards."
      confirm-label="Clear rows"
      @confirm="ws.clearRows()"
    />
    <ConfirmDialog
      v-model:open="endOpen"
      title="End the demo session?"
      description="A demo session isn't tied to an email, so its campaigns can't be opened again after you leave. Add your email in the banner to keep them."
      confirm-label="End session"
      @confirm="ws.signOut()"
    />
  </header>
</template>

<style scoped>
.wordmark {
  flex: none;
  padding: 0 6px;
  border-radius: 9999px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 32px;
}
.wordmark:hover { background: var(--muted); }
.step {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 14px 0 6px;
  border-radius: 9999px;
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 500;
  transition: background-color 150ms ease, color 150ms ease;
}
.step:hover { color: var(--foreground); background: color-mix(in oklab, var(--background) 70%, transparent); }
.step[aria-current='page'] { background: var(--foreground); color: var(--background); }
.step-n {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 11px;
}
.step[aria-current='page'] .step-n { background: color-mix(in oklab, var(--background) 22%, transparent); color: var(--background); }
.step-dot {
  position: absolute;
  top: 3px;
  right: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--muted);
}
.step[aria-current='page'] .step-dot { box-shadow: 0 0 0 2px var(--foreground); }
.step-dot.error { background: var(--destructive); }
.step-dot.draft { background: var(--shape-marigold); }
.step-dot.live { background: var(--ok); }
.progress-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  overflow: hidden;
}
.progress-line::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 30%;
  background: var(--primary);
  animation: slide 1s ease-in-out infinite;
}
@keyframes slide {
  from { transform: translateX(-100%); }
  to { transform: translateX(340%); }
}
</style>
