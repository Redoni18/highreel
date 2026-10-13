<script setup lang="ts">
// One user on the admin pages (SPEC M2.15): the account and its business,
// what they made, sent and paid in sentences, then their Highreels with how
// each went out, and their payments. Counts only: no sheet, customer or
// Highreel content of theirs is shown here.
import { ArrowLeft } from '@lucide/vue'
import type { AdminColumn } from '~/components/admin/AdminTable.vue'
import type { AdminPayment, AdminUserDetail, AdminUserHighreel } from '#shared/types/admin'
import { formatAmount, formatMoney, percent, userSummary } from '#shared/utils/admin'
import { timeAgo } from '#shared/utils/home'
import { getTemplate } from '#shared/templates'

const route = useRoute()
const { data, loading, error, load } = useAdminFetch<AdminUserDetail>(() => `/api/admin/users/${route.params.id}`)
useHead({ title: () => `${data.value?.user.email ?? 'Demo session'} · Admin · Highreel` })

const summary = computed(() => (data.value ? userSummary(data.value.user) : []))
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const when = (iso: string | null) => (iso ? timeAgo(iso) : null)

const highreelColumns: AdminColumn<AdminUserHighreel>[] = [
  { key: 'name', label: 'Highreel', value: h => h.name },
  { key: 'template', label: 'Template', value: h => getTemplate(h.template_key).label },
  { key: 'year', label: 'Year', value: h => String(h.year), sort: h => h.year, num: true },
  { key: 'status', label: 'Status', value: h => h.status },
  { key: 'rows', label: 'Rows', value: h => h.rows, num: true },
  { key: 'live', label: 'Customers', value: h => h.live, num: true, title: 'Customers\' Highreels with a link' },
  { key: 'emailed', label: 'Emailed', value: h => h.emailed, num: true },
  { key: 'whatsapp', label: 'WhatsApp', value: h => h.whatsapp, num: true },
  { key: 'opened', label: 'Opened', value: h => (h.kind === 'business' ? `${h.views.toLocaleString('en-US')} views` : h.live ? `${h.opened.toLocaleString('en-US')} · ${percent(h.opened, h.live)}` : null), sort: h => h.opened, num: true },
  { key: 'saved', label: 'Saved', value: h => h.saved, num: true },
  { key: 'shared', label: 'Shared', value: h => h.shared, num: true },
  { key: 'clicked', label: 'Clicks', value: h => h.clicked, num: true },
  { key: 'paid', label: 'Paid', value: h => (h.payments ? formatMoney(h.paid) : h.status === 'published' ? 'not paid' : null), num: true },
  { key: 'created', label: 'Made', value: h => when(h.created_at), sort: h => h.created_at },
  { key: 'published_at', label: 'Published', value: h => when(h.published_at), sort: h => h.published_at },
]
const paymentColumns: AdminColumn<AdminPayment>[] = [
  { key: 'paid_at', label: 'Paid', value: p => day(p.paid_at), sort: p => p.paid_at },
  { key: 'campaign', label: 'Highreel', value: p => p.campaign ?? (p.campaign_id ? null : 'deleted') },
  { key: 'tier', label: 'Size', value: p => p.tier },
  { key: 'amount', label: 'Amount', value: p => formatAmount(p.amount, p.currency), sort: p => p.amount, num: true },
  { key: 'status', label: 'Status', value: p => (p.refunded_at ? `refunded ${day(p.refunded_at)}` : p.status) },
]
</script>

<template>
  <div class="flex flex-col gap-10">
    <NuxtLink to="/app/admin/users" class="-mb-6 inline-flex w-fit items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground">
      <ArrowLeft class="size-4" /> Users
    </NuxtLink>
    <AdminLoad :loading="loading" :error="error" :ready="!!data" @retry="load">
      <template v-if="data">
        <section class="flex flex-col gap-3" aria-labelledby="user-title">
          <div class="flex flex-wrap items-center gap-3">
            <h1 id="user-title" class="title min-w-0 text-[30px] leading-tight font-semibold tracking-[-0.025em]">{{ data.user.email ?? 'Demo session' }}</h1>
            <RoleBadge :role="data.user.role" />
          </div>
          <p class="flex flex-wrap gap-x-2 text-[14px] text-muted-foreground" data-testid="facts">
            <span>Signed up {{ day(data.user.created_at) }}</span>
            <span>· last seen {{ data.user.last_seen ? timeAgo(data.user.last_seen) : 'unknown' }}</span>
            <span>· {{ data.sessions }} open {{ data.sessions === 1 ? 'session' : 'sessions' }}</span>
            <span class="font-mono text-[12px] leading-5">· {{ data.user.id }}</span>
          </p>
          <p v-if="data.business" class="flex flex-wrap items-center gap-x-2 text-[14px] text-muted-foreground" data-testid="business">
            <span class="size-3 rounded-full" :style="{ background: data.business.accent_color }" aria-hidden="true" />
            <span class="font-medium text-foreground">{{ data.business.name }}</span>
            <span v-if="data.business.website_url">· {{ data.business.website_url }}</span>
            <span>· {{ data.business.email_provider ? `email connected (${data.business.email_provider})` : 'no email connected' }}</span>
          </p>
          <div class="mt-2 flex max-w-[48ch] flex-col gap-1 text-[24px] leading-[1.25] font-semibold tracking-[-0.02em] text-balance text-muted-foreground">
            <p v-for="(line, i) in summary" :key="i" data-testid="summary"><AdminPhrase :phrase="line" /></p>
          </div>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="user-highreels">
          <h2 id="user-highreels" class="text-[18px] font-semibold tracking-[-0.015em]">Highreels</h2>
          <AdminTable :columns="highreelColumns" :rows="data.highreels" :row-key="h => h.id" label="Their Highreels" :min-width="1280" empty="No Highreels yet.">
            <template #cell-paid="{ row, value }">
              <PaidCell :unpaid="row.status === 'published' && !row.payments" :value="value" />
            </template>
          </AdminTable>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="user-payments">
          <h2 id="user-payments" class="text-[18px] font-semibold tracking-[-0.015em]">Payments</h2>
          <AdminTable :columns="paymentColumns" :rows="data.payments" :row-key="p => p.id" label="Their payments" :min-width="640" empty="No payments." sort-key="paid_at" />
        </section>
      </template>
    </AdminLoad>
  </div>
</template>

<style scoped>
/* A long address breaks anywhere rather than widen a phone's page. */
.title { overflow-wrap: anywhere; }
</style>
