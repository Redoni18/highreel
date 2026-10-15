<script setup lang="ts">
// Every payment on the admin pages (SPEC M2.15), newest first, under four
// cards (M2.16, owner 2026-10-15: "how much has been paid, how much goes to
// Whop, how much I take home, and anything refunded"). What Whop keeps is
// Whop's own figure (payments.net, from its amount_after_fees); payments
// recorded before Whop said it count apart.
import type { AdminColumn } from '~/components/admin/AdminTable.vue'
import type { AdminPayment } from '#shared/types/admin'
import { feeOf, formatAmount, paymentCards, paymentTotals } from '#shared/utils/admin'

useHead({ title: 'Payments · Admin · Highreel' })
const { data, loading, error, load } = useAdminFetch<{ payments: AdminPayment[], more: boolean }>(() => '/api/admin/payments')

const cards = computed(() => paymentCards(paymentTotals(data.value?.payments ?? [])))
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const money = (v: number | null, currency: string) => (v == null ? null : formatAmount(v, currency))
const columns: AdminColumn<AdminPayment>[] = [
  { key: 'paid_at', label: 'Paid', value: p => day(p.paid_at), sort: p => p.paid_at },
  { key: 'owner', label: 'Account', value: p => p.business, title: 'The business, with its account under it' },
  { key: 'campaign', label: 'Highreel', value: p => p.campaign ?? (p.campaign_id ? null : 'deleted') },
  { key: 'amount', label: 'Amount', value: p => formatAmount(p.amount, p.currency), sort: p => p.amount, num: true, title: 'Before tax' },
  { key: 'fee', label: 'Whop\'s fee', value: p => money(feeOf(p), p.currency), sort: p => feeOf(p), num: true },
  { key: 'net', label: 'Taken home', value: p => money(p.net, p.currency), sort: p => p.net, num: true, title: 'What Whop pays out' },
  { key: 'status', label: 'Status', value: p => (p.refunded_at ? `refunded ${day(p.refunded_at)}` : p.status) },
]
</script>

<template>
  <section class="flex flex-col gap-5" aria-labelledby="payments-title">
    <h1 id="payments-title" class="text-[22px] font-semibold tracking-[-0.02em]">Payments</h1>
    <AdminLoad :loading="loading" :error="error" :ready="!!data" @retry="load">
      <template v-if="data">
        <div class="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="cards">
          <StatCard v-for="c in cards" :key="c.label" :label="c.label" :value="c.value" :detail="c.detail" :flag="c.flag" />
        </div>
        <p v-if="data.more" class="text-[13px] text-muted-foreground">Counting the newest {{ data.payments.length.toLocaleString('en-US') }} payments.</p>
        <AdminTable
          v-if="data.payments.length"
          :columns="columns"
          :rows="data.payments"
          :row-key="p => p.id"
          :to="p => `/app/admin/users/${p.owner_id}`"
          label="Payments"
          :min-width="960"
          tall
          sort-key="paid_at"
        >
          <template #cell-owner="{ row }">
            <NuxtLink :to="`/app/admin/users/${row.owner_id}`" class="flex max-w-[260px] min-w-0 flex-col gap-0.5 leading-tight">
              <span class="truncate font-medium hover:underline" data-business>{{ row.business }}</span>
              <span class="truncate text-[12px] text-muted-foreground" data-email>{{ row.owner_email ?? 'demo' }}</span>
            </NuxtLink>
          </template>
          <template #cell-campaign="{ row, value }">
            <span class="flex max-w-[260px] min-w-0 flex-col gap-0.5 leading-tight">
              <span class="truncate">{{ value }}</span>
              <span v-if="row.tier" class="truncate text-[12px] text-muted-foreground" data-tier>{{ row.tier }}</span>
            </span>
          </template>
        </AdminTable>
        <p v-else class="max-w-prose text-[15px] text-muted-foreground" data-testid="summary">
          No payments yet. Each one shows up here when Whop tells us about it, with the business, the Highreel, the amount and Whop's fee.
        </p>
      </template>
    </AdminLoad>
  </section>
</template>
