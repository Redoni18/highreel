<script setup lang="ts">
// One user on the admin pages (SPEC M2.15, laid out again in M2.16): the
// address with Block and Remove account on top; four cards (Highreels,
// customers reached, emails, spent); their Highreels and payments in the
// main column, the account's and the business's details in a side panel. A
// Highreel row opens its numbers in a sheet (?highreel=<id>, so the
// Highreels list and the overview can link straight to it). Counts only: no
// sheet, customer or Highreel content of theirs is shown here.
import { ArrowLeft } from '@lucide/vue'
import type { AdminColumn } from '~/components/admin/AdminTable.vue'
import type { AdminPayment, AdminUserDetail, AdminUserHighreel } from '#shared/types/admin'
import { feeOf, formatAmount, formatMoney, percent, userCards, userStage } from '#shared/utils/admin'
import { timeAgo } from '#shared/utils/home'
import { getTemplate } from '#shared/templates'

const route = useRoute()
const router = useRouter()
const { data, loading, error, load } = useAdminFetch<AdminUserDetail>(() => `/api/admin/users/${route.params.id}`)
useHead({ title: () => `${data.value?.user.email ?? 'Demo session'} · Admin · Highreel` })

const cards = computed(() => (data.value ? userCards(data.value.user) : []))
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const when = (iso: string | null) => (iso ? timeAgo(iso) : null)

// The open Highreel's sheet follows ?highreel= (a link opens it; closing it drops the query).
const shown = computed(() => data.value?.highreels.find(h => h.id === route.query.highreel) ?? null)
const sheetOpen = computed({
  get: () => !!shown.value,
  set: (v: boolean) => {
    if (!v)
      router.replace({ query: {} })
  },
})
const openHighreel = (h: AdminUserHighreel) => router.replace({ query: { highreel: h.id } })

const account = computed(() => {
  const d = data.value
  if (!d)
    return []
  return [
    { label: 'Signed up', value: day(d.user.created_at) },
    { label: 'Last seen', value: d.user.last_seen ? timeAgo(d.user.last_seen) : 'unknown' },
    { label: 'Open sessions', value: String(d.sessions) },
    { label: 'Id', value: d.user.id, mono: true },
  ]
})
const business = computed(() => {
  const b = data.value?.business
  if (!b)
    return []
  return [
    { label: 'Website', value: b.website_url ?? '–' },
    { label: 'Email', value: b.email_provider ? `connected (${b.email_provider})` : 'not connected' },
    { label: 'Made', value: day(b.created_at) },
  ]
})

const paidOf = (h: AdminUserHighreel) => (h.kind === 'business' ? 'free' : h.payments ? formatMoney(h.paid) : h.status === 'published' ? 'not paid' : null)
const highreelColumns: AdminColumn<AdminUserHighreel>[] = [
  { key: 'name', label: 'Highreel', value: h => h.name },
  { key: 'status', label: 'Status', value: h => h.status },
  { key: 'live', label: 'Customers', value: h => (h.kind === 'business' ? null : h.live), num: true, title: 'Customers\' Highreels with a link' },
  { key: 'opened', label: 'Opened', value: h => (h.kind === 'business' ? `${h.views.toLocaleString('en-US')} views` : h.live ? percent(h.opened, h.live) : null), sort: h => (h.kind === 'business' ? h.views : h.opened), num: true },
  { key: 'paid', label: 'Paid', value: paidOf, num: true },
  { key: 'published_at', label: 'Published', value: h => when(h.published_at), sort: h => h.published_at },
]
const paymentColumns: AdminColumn<AdminPayment>[] = [
  { key: 'paid_at', label: 'Paid', value: p => day(p.paid_at), sort: p => p.paid_at },
  { key: 'campaign', label: 'Highreel', value: p => p.campaign ?? (p.campaign_id ? null : 'deleted') },
  { key: 'amount', label: 'Amount', value: p => formatAmount(p.amount, p.currency), sort: p => p.amount, num: true },
  { key: 'fee', label: 'Whop\'s fee', value: p => (feeOf(p) == null ? null : formatAmount(feeOf(p)!, p.currency)), sort: p => feeOf(p), num: true },
  { key: 'status', label: 'Status', value: p => (p.refunded_at ? `refunded ${day(p.refunded_at)}` : p.status) },
]
</script>

<template>
  <div class="flex flex-col gap-8">
    <NuxtLink to="/app/admin/users" class="-mb-4 inline-flex w-fit items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground">
      <ArrowLeft class="size-4" /> Users
    </NuxtLink>
    <AdminLoad :loading="loading" :error="error" :ready="!!data" @retry="load">
      <template v-if="data">
        <section class="flex flex-col gap-5" aria-labelledby="user-title">
          <div class="flex flex-wrap items-center gap-3">
            <h1 id="user-title" class="title min-w-0 text-[28px] leading-tight font-semibold tracking-[-0.025em]">{{ data.user.email ?? 'Demo session' }}</h1>
            <StagePill :stage="userStage(data.user)" />
            <RoleBadge v-if="data.user.role === 'admin'" :role="data.user.role" />
            <BlockedBadge v-if="data.user.blocked" />
            <div class="ml-auto">
              <AdminUserActions :user="data.user" variant="buttons" @changed="load" @removed="navigateTo('/app/admin/users', { replace: true })" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="cards">
            <StatCard v-for="c in cards" :key="c.label" :label="c.label" :value="c.value" :detail="c.detail" :flag="c.flag" />
          </div>
        </section>

        <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div class="flex min-w-0 flex-col gap-8">
            <section class="flex flex-col gap-3" aria-labelledby="user-highreels">
              <h2 id="user-highreels" class="text-[18px] font-semibold tracking-[-0.015em]">Highreels <span class="text-[13px] font-normal text-muted-foreground">· click one for all its numbers</span></h2>
              <AdminTable :columns="highreelColumns" :rows="data.highreels" :row-key="h => h.id" :pick="openHighreel" label="Their Highreels" :min-width="640" tall empty="No Highreels yet.">
                <template #cell-name="{ row }">
                  <button type="button" class="flex max-w-[320px] min-w-0 flex-col items-start gap-0.5 text-left leading-tight" @click="openHighreel(row)">
                    <span class="max-w-full truncate font-medium hover:underline">{{ row.name }}</span>
                    <span class="max-w-full truncate text-[12px] text-muted-foreground">{{ row.kind === 'business' ? 'Their business year' : getTemplate(row.template_key).label }} · {{ row.year }}</span>
                  </button>
                </template>
                <template #cell-status="{ row }">
                  <span class="inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium" :class="row.status === 'published' ? 'bg-ok/12 text-ok-text' : 'bg-muted text-muted-foreground'">{{ row.status }}</span>
                </template>
                <template #cell-paid="{ row, value }">
                  <PaidCell :unpaid="row.kind === 'customers' && row.status === 'published' && !row.payments" :value="value" />
                </template>
              </AdminTable>
            </section>

            <section class="flex flex-col gap-3" aria-labelledby="user-payments">
              <h2 id="user-payments" class="text-[18px] font-semibold tracking-[-0.015em]">Payments</h2>
              <AdminTable :columns="paymentColumns" :rows="data.payments" :row-key="p => p.id" label="Their payments" :min-width="560" empty="No payments." sort-key="paid_at" />
            </section>
          </div>

          <aside class="flex min-w-0 flex-col gap-4">
            <AdminPanel title="Account" data-testid="facts">
              <dl class="facts">
                <div v-for="f in account" :key="f.label">
                  <dt>{{ f.label }}</dt>
                  <dd :class="{ 'font-mono text-[11.5px] break-all': f.mono }">{{ f.value }}</dd>
                </div>
              </dl>
            </AdminPanel>
            <AdminPanel title="Business" data-testid="business">
              <template v-if="data.business">
                <p class="truncate text-[14px] font-medium">{{ data.business.name }}</p>
                <dl class="facts">
                  <div v-for="f in business" :key="f.label">
                    <dt>{{ f.label }}</dt>
                    <dd>{{ f.value }}</dd>
                  </div>
                </dl>
              </template>
              <p v-else class="py-1 text-[14px] text-muted-foreground">No business.</p>
            </AdminPanel>
          </aside>
        </div>

        <AdminHighreelSheet v-model:open="sheetOpen" :highreel="shown" />
      </template>
    </AdminLoad>
  </div>
</template>

<style scoped>
/* A long address breaks anywhere rather than widen a phone's page. */
.title { overflow-wrap: anywhere; }
.facts { display: flex; flex-direction: column; font-size: 14px; }
.facts > div {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px dashed var(--border);
}
.facts > div:last-child { border-bottom: 0; }
.facts dt { flex: none; color: var(--muted-foreground); }
.facts dd { min-width: 0; overflow-wrap: anywhere; text-align: right; }
</style>
