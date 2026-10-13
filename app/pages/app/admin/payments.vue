<script setup lang="ts">
// Every payment on the admin pages (SPEC M2.15), newest first. They come
// from the checkout's webhook (Whop, SPEC §10); until that's built the list
// is empty and says so.
import type { AdminColumn } from '~/components/admin/AdminTable.vue'
import type { AdminPayment, Money } from '#shared/types/admin'
import { formatAmount, formatMoney } from '#shared/utils/admin'

useHead({ title: 'Payments · Admin · Highreel' })
const { data, loading, error, load } = useAdminFetch<{ payments: AdminPayment[], more: boolean }>(() => '/api/admin/payments')

const totals = computed(() => {
  const paid = (data.value?.payments ?? []).filter(p => p.status === 'paid')
  const money: Money = {}
  for (const p of paid)
    money[p.currency] = (money[p.currency] ?? 0) + p.amount
  return { money, paid: paid.length, refunded: (data.value?.payments.length ?? 0) - paid.length }
})
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const columns: AdminColumn<AdminPayment>[] = [
  { key: 'paid_at', label: 'Paid', value: p => day(p.paid_at), sort: p => p.paid_at },
  { key: 'business', label: 'Business', value: p => p.business },
  { key: 'owner', label: 'Account', value: p => p.owner_email ?? 'demo' },
  { key: 'campaign', label: 'Highreel', value: p => p.campaign ?? (p.campaign_id ? null : 'deleted') },
  { key: 'tier', label: 'Size', value: p => p.tier },
  { key: 'amount', label: 'Amount', value: p => formatAmount(p.amount, p.currency), sort: p => p.amount, num: true },
  { key: 'status', label: 'Status', value: p => (p.refunded_at ? `refunded ${day(p.refunded_at)}` : p.status) },
]
</script>

<template>
  <section class="flex flex-col gap-4" aria-labelledby="payments-title">
    <h1 id="payments-title" class="text-[22px] font-semibold tracking-[-0.02em]">Payments</h1>
    <AdminLoad :loading="loading" :error="error" :ready="!!data" @retry="load">
      <template v-if="data">
        <p v-if="data.payments.length" class="text-[15px] text-muted-foreground" data-testid="summary">
          <span class="font-mono text-foreground">{{ formatMoney(totals.money) }}</span> from {{ totals.paid }} {{ totals.paid === 1 ? 'payment' : 'payments' }}<template v-if="totals.refunded">, and {{ totals.refunded }} refunded</template><template v-if="data.more"> (the newest {{ data.payments.length.toLocaleString('en-US') }})</template>.
        </p>
        <p v-else class="max-w-prose text-[15px] text-muted-foreground" data-testid="summary">
          No payments yet. Each one shows up here when checkout's webhook records it, with the business, the Highreel and the amount.
        </p>
        <AdminTable
          v-if="data.payments.length"
          :columns="columns"
          :rows="data.payments"
          :row-key="p => p.id"
          :to="p => `/app/admin/users/${p.owner_id}`"
          label="Payments"
          :min-width="900"
          sort-key="paid_at"
        />
      </template>
    </AdminLoad>
  </section>
</template>
