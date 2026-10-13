<script setup lang="ts">
// The business home, "Your year" (SPEC M2.5 P3): the year at a glance in
// sentences, the drafts that need attention, the year's recaps as a table and
// the latest opens, saves and shares. No cards or charts (SPEC §6).
// Client-only (see routeRules). Old /app?c=… links go to /app/c/….
import { ArrowRight, ChevronDown, Loader2, Palette, Plus, Sparkles } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Business, Campaign, CampaignKind, CreatedCampaign, HomeCampaign, HomeData } from '#shared/types/recap'
import { activityText, attention, timeAgo, yearSummary } from '#shared/utils/home'

definePageMeta({
  middleware: [to => (typeof to.query.c === 'string' ? navigateTo(`/app/c/${to.query.c}`, { replace: true }) : undefined)],
})
useHead({ title: 'Your Highreels · Highreel' })

const route = useRoute()
const router = useRouter()
const { api, fail, endSession } = useApi()
const { cache, setBusiness } = useAppCache()

const year = ref(Number(route.query.year) || new Date().getFullYear())
// Back here in this visit: the last answer at once, a fresh one underneath (SPEC §7.7).
const data = ref<HomeData | null>(cache.home[year.value] ?? null)
const loading = ref(!data.value)
/** Asking the server while showing the last answer (main is aria-busy). */
const refreshing = ref(false)
const loadError = ref<string | null>(null)

async function load() {
  const y = year.value
  loadError.value = null
  refreshing.value = true
  try {
    const fresh = await api<HomeData>('/api/home', { query: { year: y } })
    cache.home[y] = fresh
    setBusiness(fresh.business, fresh.anonymous)
    if (y === year.value)
      data.value = fresh
  }
  catch (e) {
    if (isUnauthorized(e))
      return endSession()
    // With the last answer on screen, keep it and say so; without one, the page says it.
    if (data.value)
      fail('Couldn\'t refresh your Highreels', e)
    else
      loadError.value = errorMessage(e)
  }
  finally {
    loading.value = false
    refreshing.value = false
  }
}

onMounted(async () => {
  await load()
  // "Try the demo" lands here with ?start=demo: a new demo opens its first draft.
  if (route.query.start === 'demo' && data.value) {
    if (!data.value.total)
      await create({ name: `${year.value} Highreels`, year: year.value, template_key: 'app' })
    else
      await router.replace({ query: {} })
  }
})
// The workspace's code while the home sits idle (the table and New Highreel
// open it with navigateTo, which doesn't prefetch like a link): opening or
// creating a Highreel then waits only for its data (SPEC §7.7).
onNuxtReady(() => preloadRouteComponents('/app/c/new'))
// Views and shares arrive while the page sits in another tab.
let lastRefresh = Date.now()
useEventListener(document, 'visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 15_000) {
    lastRefresh = Date.now()
    load()
  }
})

function pickYear(y: number) {
  year.value = y
  data.value = cache.home[y] ?? data.value
  router.replace({ query: y === new Date().getFullYear() ? {} : { year: String(y) } })
  load()
}

const summary = computed(() => (data.value ? yearSummary(year.value, data.value.campaigns) : []))
const todo = computed(() => (data.value ? attention(data.value.campaigns) : []))
const names = computed(() => new Map((data.value?.campaigns ?? []).map(c => [c.id, c.name])))

// --- Creating, duplicating, deleting --------------------------------------------
const newOpen = ref(false)
const newKind = ref<CampaignKind>('customers')
function startNew(kind: CampaignKind = 'customers') {
  newKind.value = kind
  newOpen.value = true
}

async function create(input: { name: string, year: number, template_key: string, starter?: string }, query: Record<string, string> = {}): Promise<boolean> {
  try {
    const { business, ...c } = await api<CreatedCampaign>('/api/campaigns', { method: 'POST', body: input })
    // The workspace opens it with these, without asking again (SPEC §7.7).
    cache.created = { campaign: c, business, anonymous: !!data.value?.anonymous }
    await navigateTo({ path: `/app/c/${c.id}`, query }, { replace: route.query.start === 'demo' })
    return true
  }
  catch (e) {
    fail('Couldn\'t create the Highreel', e)
    return false
  }
}
const sampling = ref(false)
async function trySample() {
  sampling.value = true
  await create({ name: `${year.value} Highreels`, year: year.value, template_key: 'app' }, { sample: '1' })
  sampling.value = false
}

const dupOf = ref<HomeCampaign | null>(null)
const dupOpen = ref(false)
function startDuplicate(c: HomeCampaign) {
  dupOf.value = c
  dupOpen.value = true
}
async function duplicate(input: { name: string, year: number }): Promise<boolean> {
  try {
    const c = await api<Campaign>(`/api/campaigns/${dupOf.value!.id}/duplicate`, { method: 'POST', body: input })
    toast.success(`Duplicated as “${c.name}”`)
    await navigateTo(`/app/c/${c.id}`)
    return true
  }
  catch (e) {
    fail('Couldn\'t duplicate it', e)
    return false
  }
}

const delOf = ref<HomeCampaign | null>(null)
const delOpen = ref(false)
function startDelete(c: HomeCampaign) {
  delOf.value = c
  delOpen.value = true
}
const deleteText = computed(() => {
  const c = delOf.value
  if (!c)
    return ''
  const rows = c.row_count ? `Its ${c.row_count.toLocaleString('en-US')} ${c.row_count === 1 ? 'row goes' : 'rows go'} with it` : 'It has no rows'
  const links = c.published ? `, and ${c.published.toLocaleString('en-US')} published ${c.published === 1 ? 'link stops' : 'links stop'} working` : ''
  return `${rows}${links}. This can't be undone.`
})
async function remove() {
  const c = delOf.value
  if (!c)
    return
  try {
    await api(`/api/campaigns/${c.id}`, { method: 'DELETE' })
    toast(`Deleted “${c.name}”`)
    await load()
  }
  catch (e) {
    fail('Couldn\'t delete it', e)
  }
}

// First visit: the business still has the placeholder name.
const businessName = ref('')
async function saveName() {
  try {
    const b = await api<Business>('/api/business', { method: 'PATCH', body: { name: businessName.value.trim() } })
    if (data.value)
      setBusiness({ ...data.value.business, name: b.name })
  }
  catch (e) {
    fail('Couldn\'t save the name', e)
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <DemoBanner v-if="data?.anonymous" />
    <header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <span class="wordmark"><Wordmark /></span>
      <span class="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <template v-if="data">
        <span class="truncate text-[15px] font-medium">{{ data.business.name }}</span>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button type="button" class="ml-1 flex h-8 items-center gap-1 rounded-full bg-muted px-3 font-mono text-[13px] hover:bg-accent" aria-label="Switch year">
              {{ year }} <ChevronDown class="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-28 text-[13px]">
            <DropdownMenuItem v-for="y in data.years" :key="y" class="font-mono" @select="pickYear(y)">{{ y }}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </template>
      <div class="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" class="px-3 text-[14px]" as-child>
          <NuxtLink to="/app/brand"><Palette /> Your brand</NuxtLink>
        </Button>
        <Button size="sm" class="px-4 text-[14px]" :disabled="!data" @click="startNew()">
          <Plus /> New Highreel
        </Button>
        <AccountMenu :anonymous="!!data?.anonymous" />
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-12 px-4 pt-12 pb-16 md:px-8" :aria-busy="loading || refreshing">
      <div v-if="loading" class="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 class="size-4 animate-spin" />
      </div>
      <div v-else-if="loadError" class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p class="text-[18px] font-semibold">Couldn't load your Highreels</p>
        <p class="max-w-md text-[14px] text-muted-foreground">{{ loadError }}</p>
        <Button variant="outline" @click="load()">Try again</Button>
      </div>

      <!-- A brand-new account -->
      <section v-else-if="data && !data.total" class="mx-auto flex w-full max-w-3xl flex-col gap-7 py-4">
        <form v-if="data.business.name === 'My business'" class="flex flex-col gap-2 rounded-[20px] bg-muted p-4" @submit.prevent="saveName">
          <label for="biz-name" class="text-[14px] font-medium">First, what's your business called? It appears on every Highreel.</label>
          <div class="flex gap-2">
            <Input id="biz-name" v-model="businessName" maxlength="60" placeholder="Your business name" class="h-9 max-w-72 rounded-full bg-background px-4" />
            <Button type="submit" variant="outline" :disabled="!businessName.trim()">Save</Button>
          </div>
        </form>
        <div class="flex flex-col gap-1">
          <p class="note-hand text-[26px]">your {{ year }}</p>
          <h1 class="text-[40px] leading-[1.08] font-semibold tracking-[-0.03em]">Make your first Highreel.</h1>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <button type="button" class="choice group" @click="startNew('customers')">
            <LandingShape kind="clover" class="size-9 text-[var(--shape-green)]" />
            <span class="mt-4 text-[19px] font-semibold tracking-[-0.015em]">A Highreel for each customer</span>
            <span class="mt-1 text-[15px] text-muted-foreground">Upload a sheet with one row per customer. Each of them gets their own Highreel and link to share.</span>
            <ArrowRight class="mt-5 size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
          </button>
          <button type="button" class="choice group" @click="startNew('business')">
            <LandingShape kind="poppy" class="size-9 text-[var(--shape-poppy)]" />
            <span class="mt-4 text-[19px] font-semibold tracking-[-0.015em]">A Highreel of your business year</span>
            <span class="mt-1 text-[15px] text-muted-foreground">One Highreel about your year, to post on Instagram, Facebook or LinkedIn.</span>
            <ArrowRight class="mt-5 size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
          </button>
        </div>
        <p class="flex flex-wrap items-center gap-3 text-[15px] text-muted-foreground">
          Not ready with your own data?
          <Button variant="outline" :disabled="sampling" @click="trySample">
            <Sparkles /> Try it with sample data
          </Button>
        </p>
      </section>

      <template v-else-if="data">
        <section class="flex flex-col gap-3" aria-labelledby="year-title">
          <h1 id="year-title" class="note-hand text-[26px]">Your {{ year }}</h1>
          <div v-if="summary.length" class="flex max-w-[36ch] flex-col gap-1 text-[30px] leading-[1.22] font-semibold tracking-[-0.022em] text-balance text-muted-foreground">
            <p v-for="(line, i) in summary" :key="i" data-testid="summary">
              <template v-for="(part, j) in line" :key="j"><span v-if="typeof part === 'string'">{{ part }}</span><span v-else class="font-bold text-foreground">{{ part.n }}</span></template>
            </p>
          </div>
          <p v-else class="text-[30px] leading-[1.22] font-semibold tracking-[-0.022em]">No Highreels in {{ year }} yet.</p>
          <ul v-if="todo.length" class="mt-2 flex flex-col gap-1 text-[14px]" aria-label="Needs attention">
            <li v-for="t in todo" :key="t.id" data-testid="attention">
              <NuxtLink :to="`/app/c/${t.id}`" class="group inline-flex items-center gap-x-2 text-muted-foreground hover:text-foreground">
                <span class="size-2 rounded-full bg-[var(--shape-marigold)]" aria-hidden="true" />
                <span><span class="font-medium text-foreground">{{ t.name }}</span>: </span>
                <span><template v-for="(part, j) in t.text" :key="j"><span v-if="typeof part === 'string'">{{ part }}</span><span v-else class="font-mono text-[13px]">{{ part.n }}</span></template></span>
                <ArrowRight class="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="recaps-title">
          <h2 id="recaps-title" class="text-[18px] font-semibold tracking-[-0.015em]">Highreels</h2>
          <RecapsTable v-if="data.campaigns.length" :campaigns="data.campaigns" @open="id => navigateTo(`/app/c/${id}`)" @duplicate="startDuplicate" @remove="startDelete" />
          <div v-else class="flex items-center gap-3 rounded-2xl bg-muted px-5 py-5 text-[14px] text-muted-foreground">
            Nothing in {{ year }}.
            <Button variant="outline" size="sm" class="bg-background" @click="startNew()"><Plus /> New Highreel</Button>
          </div>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="activity-title">
          <h2 id="activity-title" class="text-[18px] font-semibold tracking-[-0.015em]">Recent activity</h2>
          <ul v-if="data.activity.length" class="flex flex-col text-[14px]">
            <li v-for="(a, i) in data.activity" :key="i" class="flex h-9 items-center gap-1.5 border-b border-dashed last:border-0" data-testid="activity">
              <span class="font-medium">{{ activityText(a).who }}</span>
              <span>{{ activityText(a).verb }}</span>
              <span class="text-muted-foreground">· {{ names.get(a.campaign_id) }}</span>
              <span class="ml-auto font-mono text-[12px] text-muted-foreground" :title="new Date(a.at).toLocaleString()">{{ timeAgo(a.at) }}</span>
            </li>
          </ul>
          <p v-else class="text-[14px] text-muted-foreground">Opens, saves and shares show up here once your Highreels go out.</p>
        </section>
      </template>
    </main>

    <NewRecapDialog v-model:open="newOpen" :kind="newKind" :create="create" />
    <DuplicateDialog v-model:open="dupOpen" :campaign="dupOf" :duplicate="duplicate" />
    <ConfirmDialog v-model:open="delOpen" :title="`Delete “${delOf?.name}”?`" :description="deleteText" confirm-label="Delete" @confirm="remove" />
  </div>
</template>

<style scoped>
.wordmark {
  padding: 0 4px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.035em;
}
/* The "first recap" choices: the landing's grey cards. */
.choice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 24px 24px 22px;
  border-radius: 24px;
  background: var(--muted);
  text-align: left;
  transition: background-color 160ms ease, transform 220ms cubic-bezier(0.25, 1.35, 0.45, 1);
}
.choice:hover { background: color-mix(in oklab, var(--foreground) 8%, var(--muted)); }
.choice:active { transform: scale(0.985); }
</style>
