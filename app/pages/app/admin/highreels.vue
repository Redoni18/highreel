<script setup lang="ts">
// Every Highreel on the admin pages (SPEC M2.15, fewer columns since M2.16):
// all accounts' campaigns, newest first: the Highreel (template and year
// under it), its owner (business, address under it), status, customers,
// opens and payment. Filters in the URL (?show=, ?demos=1); a row opens its
// owner's page with this Highreel's numbers open (the admin pages don't open
// a business's workspace).
import { Search } from '@lucide/vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AdminColumn } from '~/components/admin/AdminTable.vue'
import type { AdminHighreel, AdminHighreels } from '#shared/types/admin'
import { formatMoney, moneySize, percent } from '#shared/utils/admin'
import { timeAgo } from '#shared/utils/home'
import { getTemplate } from '#shared/templates'

useHead({ title: 'Highreels · Admin · Highreel' })
type Show = 'all' | 'draft' | 'published' | 'unpaid' | 'paid'
const SHOWS: Show[] = ['all', 'draft', 'published', 'unpaid', 'paid']
const route = useRoute()
const router = useRouter()
function setQuery(change: Record<string, string | undefined>) {
  const query = { ...route.query, ...change }
  for (const k of Object.keys(query)) {
    if (query[k] === undefined)
      delete query[k]
  }
  router.replace({ query })
}
const show = computed<Show>({
  get: () => SHOWS.find(s => s === route.query.show) ?? 'all',
  set: s => setQuery({ show: s === 'all' ? undefined : s }),
})
const demos = computed({
  get: () => route.query.demos === '1',
  set: (on: boolean | 'indeterminate') => setQuery({ demos: on === true ? '1' : undefined }),
})
const { data, loading, error, load } = useAdminFetch<AdminHighreels>(() => '/api/admin/highreels', (): Record<string, string> => (demos.value ? { demos: '1' } : {}))

const MATCH: Record<Show, (h: AdminHighreel) => boolean> = {
  all: () => true,
  draft: h => h.status === 'draft',
  published: h => h.status === 'published',
  // A business's own Highreel is free (SPEC §10).
  unpaid: h => h.kind === 'customers' && h.status === 'published' && !h.payments,
  paid: h => h.payments > 0,
}
const options = computed(() => {
  const all = data.value?.highreels ?? []
  const label = (s: Show, name: string) => (data.value ? `${name} ${all.filter(MATCH[s]).length.toLocaleString('en-US')}` : name)
  return [
    { value: 'all' as const, label: label('all', 'All') },
    { value: 'draft' as const, label: label('draft', 'Drafts') },
    { value: 'published' as const, label: label('published', 'Published') },
    { value: 'unpaid' as const, label: label('unpaid', 'Not paid') },
    { value: 'paid' as const, label: label('paid', 'Paid') },
  ]
})
const search = ref('')
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (data.value?.highreels ?? []).filter(MATCH[show.value]).filter(h => !q || `${h.name} ${h.business} ${h.owner_email ?? ''}`.toLowerCase().includes(q))
})

const when = (iso: string | null) => (iso ? timeAgo(iso) : null)
const columns: AdminColumn<AdminHighreel>[] = [
  { key: 'name', label: 'Highreel', value: h => h.name },
  { key: 'owner', label: 'Owner', value: h => h.business, title: 'The business, with its account under it' },
  { key: 'status', label: 'Status', value: h => h.status },
  { key: 'live', label: 'Customers', value: h => (h.kind === 'business' ? null : h.live), num: true, title: 'Customers\' Highreels with a link' },
  { key: 'opened', label: 'Opened', value: h => (h.kind === 'business' ? `${h.views.toLocaleString('en-US')} views` : h.live ? percent(h.opened, h.live) : null), sort: h => (h.kind === 'business' ? h.views : h.opened), num: true },
  { key: 'paid', label: 'Paid', value: h => (h.kind === 'business' ? 'free' : h.payments ? formatMoney(h.paid) : h.status === 'published' ? 'not paid' : null), sort: h => moneySize(h.paid), num: true },
  { key: 'created', label: 'Made', value: h => when(h.created_at), sort: h => h.created_at },
]
</script>

<template>
  <section class="flex flex-col gap-4" aria-labelledby="highreels-title">
    <div class="flex flex-wrap items-center gap-3">
      <h1 id="highreels-title" class="mr-2 text-[22px] font-semibold tracking-[-0.02em]">Highreels</h1>
      <!-- Five choices don't fit a phone's width: they scroll in their own box. -->
      <div class="scrollbar-none max-w-full overflow-x-auto">
        <Segmented v-model="show" :options="options" label="Which Highreels" />
      </div>
      <div class="flex items-center gap-2">
        <Checkbox id="with-demos" v-model="demos" />
        <Label for="with-demos" class="text-[14px] font-normal text-muted-foreground">Include demos</Label>
      </div>
      <div class="relative ml-auto w-full sm:w-72">
        <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" type="search" aria-label="Search Highreels" placeholder="Name, business or email" class="h-9 rounded-full pl-9" />
      </div>
    </div>
    <AdminLoad :loading="loading" :error="error" :ready="!!data" @retry="load">
      <AdminTable
        :columns="columns"
        :rows="shown"
        :row-key="h => h.id"
        :to="h => `/app/admin/users/${h.owner_id}?highreel=${h.id}`"
        label="Highreels"
        :min-width="900"
        tall
        :empty="search ? 'No Highreel matches that.' : 'None here.'"
      >
        <template #cell-name="{ row }">
          <NuxtLink :to="`/app/admin/users/${row.owner_id}?highreel=${row.id}`" class="flex max-w-[320px] min-w-0 flex-col gap-0.5 leading-tight">
            <span class="truncate font-medium hover:underline">{{ row.name }}</span>
            <span class="truncate text-[12px] text-muted-foreground">{{ row.kind === 'business' ? 'Their business year' : getTemplate(row.template_key).label }} · {{ row.year }}</span>
          </NuxtLink>
        </template>
        <template #cell-owner="{ row }">
          <span class="flex max-w-[280px] min-w-0 flex-col gap-0.5 leading-tight">
            <span class="truncate" data-business>{{ row.business }}</span>
            <span class="truncate text-[12px] text-muted-foreground" data-email>{{ row.owner_email ?? 'demo' }}</span>
          </span>
        </template>
        <template #cell-status="{ row }">
          <span class="inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium" :class="row.status === 'published' ? 'bg-ok/12 text-ok-text' : 'bg-muted text-muted-foreground'">{{ row.status }}</span>
        </template>
        <template #cell-paid="{ row, value }">
          <PaidCell :unpaid="MATCH.unpaid(row)" :value="value" />
        </template>
      </AdminTable>
      <p v-if="data?.more" class="text-[13px] text-muted-foreground">Showing the newest {{ data.highreels.length.toLocaleString('en-US') }}.</p>
    </AdminLoad>
  </section>
</template>
