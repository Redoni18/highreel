<script setup lang="ts">
// The admin overview (SPEC M2.15): the service's numbers in short lists
// (people, Highreels, their customers, money; owner, 2026-10-13: easy to
// read, no sentences), then the newest accounts, the latest published
// Highreels and the latest payments. Demo sessions are counted apart and left
// out of the rest.
import type { AdminOverview } from '#shared/types/admin'
import { formatAmount, overviewFigures } from '#shared/utils/admin'
import { timeAgo } from '#shared/utils/home'

const { data, loading, error, load } = useAdminFetch<AdminOverview>(() => '/api/admin/overview')
const figures = computed(() => (data.value ? overviewFigures(data.value) : []))
const fmt = (x: number) => x.toLocaleString('en-US')
</script>

<template>
  <AdminLoad :loading="loading" :error="error" :ready="!!data" @retry="load">
    <template v-if="data">
      <section class="flex flex-col gap-5" aria-labelledby="overview-title">
        <h1 id="overview-title" class="text-[22px] font-semibold tracking-[-0.02em]">Overview</h1>
        <AdminFigures :groups="figures" />
      </section>

      <div class="grid gap-10 lg:grid-cols-3">
        <section class="flex min-w-0 flex-col gap-2" aria-labelledby="newest-title">
          <h2 id="newest-title" class="flex items-baseline justify-between text-[18px] font-semibold tracking-[-0.015em]">
            Newest accounts
            <NuxtLink to="/app/admin/users" class="text-[13px] font-normal text-muted-foreground hover:text-foreground">All users</NuxtLink>
          </h2>
          <ul v-if="data.newest.length" class="flex flex-col text-[14px]">
            <li v-for="u in data.newest" :key="u.id" class="border-b border-dashed last:border-0" data-testid="newest">
              <NuxtLink :to="`/app/admin/users/${u.id}`" class="flex h-9 items-center gap-2 hover:text-foreground">
                <span class="truncate font-medium">{{ u.email }}</span>
                <span class="truncate text-muted-foreground">· {{ u.business }}</span>
                <span class="ml-auto shrink-0 font-mono text-[12px] text-muted-foreground" :title="new Date(u.created_at).toLocaleString()">{{ timeAgo(u.created_at) }}</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="text-[14px] text-muted-foreground">No accounts yet.</p>
        </section>

        <section class="flex min-w-0 flex-col gap-2" aria-labelledby="published-title">
          <h2 id="published-title" class="flex items-baseline justify-between text-[18px] font-semibold tracking-[-0.015em]">
            Latest published
            <NuxtLink to="/app/admin/highreels?show=published" class="text-[13px] font-normal text-muted-foreground hover:text-foreground">All Highreels</NuxtLink>
          </h2>
          <ul v-if="data.latest_published.length" class="flex flex-col text-[14px]">
            <li v-for="h in data.latest_published" :key="h.id" class="border-b border-dashed last:border-0" data-testid="published">
              <NuxtLink :to="`/app/admin/users/${h.owner_id}`" class="flex h-9 items-center gap-2">
                <span class="truncate font-medium">{{ h.name }}</span>
                <span class="truncate text-muted-foreground">· {{ h.business }}</span>
                <span class="ml-auto shrink-0 font-mono text-[12px] text-muted-foreground" :title="h.published_at ? new Date(h.published_at).toLocaleString() : ''">{{ fmt(h.live) }} · {{ timeAgo(h.published_at!) }}</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="text-[14px] text-muted-foreground">Nothing published yet.</p>
        </section>

        <section class="flex min-w-0 flex-col gap-2" aria-labelledby="payments-title">
          <h2 id="payments-title" class="flex items-baseline justify-between text-[18px] font-semibold tracking-[-0.015em]">
            Latest payments
            <NuxtLink to="/app/admin/payments" class="text-[13px] font-normal text-muted-foreground hover:text-foreground">All payments</NuxtLink>
          </h2>
          <ul v-if="data.latest_payments.length" class="flex flex-col text-[14px]">
            <li v-for="p in data.latest_payments" :key="p.id" class="border-b border-dashed last:border-0" data-testid="payment">
              <NuxtLink :to="`/app/admin/users/${p.owner_id}`" class="flex h-9 items-center gap-2">
                <span class="font-mono text-[13px]" :class="{ 'text-muted-foreground line-through': p.status === 'refunded' }">{{ formatAmount(p.amount, p.currency) }}</span>
                <span class="truncate font-medium">{{ p.business }}</span>
                <span class="ml-auto shrink-0 font-mono text-[12px] text-muted-foreground" :title="new Date(p.paid_at).toLocaleString()">{{ timeAgo(p.paid_at) }}</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="text-[14px] text-muted-foreground">Payments show up here once checkout is live.</p>
        </section>
      </div>
    </template>
  </AdminLoad>
</template>
