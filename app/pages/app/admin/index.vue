<script setup lang="ts">
// The admin overview (SPEC M2.15, laid out again in M2.16). Owner,
// 2026-10-15: the four lists of equal weight were "scrambled", with nowhere
// to start. Now, top to bottom: what needs a look (if anything), four cards
// with the headline numbers, four panels (from sign-up to paid, what their
// customers did, people, money), then the newest accounts, the latest
// published Highreels and the latest payments. Demo sessions are counted
// apart and left out of the rest.
import { ArrowRight } from '@lucide/vue'
import type { AdminOverview } from '#shared/types/admin'
import { formatAmount, overviewAlerts, overviewCards, overviewPanels } from '#shared/utils/admin'
import { timeAgo } from '#shared/utils/home'

const { data, loading, error, load } = useAdminFetch<AdminOverview>(() => '/api/admin/overview')
const cards = computed(() => (data.value ? overviewCards(data.value) : []))
const alerts = computed(() => (data.value ? overviewAlerts(data.value) : []))
const panels = computed(() => (data.value ? overviewPanels(data.value) : []))
const fmt = (x: number) => x.toLocaleString('en-US')
</script>

<template>
  <AdminLoad :loading="loading" :error="error" :ready="!!data" @retry="load">
    <div v-if="data" class="flex flex-col gap-8">
      <section class="flex flex-col gap-4" aria-labelledby="overview-title">
        <h1 id="overview-title" class="text-[22px] font-semibold tracking-[-0.02em]">Overview</h1>
        <NuxtLink
          v-for="a in alerts"
          :key="a.label"
          :to="a.to!"
          class="alert group"
          data-testid="alert"
        >
          <span class="size-2 shrink-0 rounded-full bg-[var(--shape-marigold)]" aria-hidden="true" />
          <span class="shrink-0 font-medium whitespace-nowrap">Needs a look:</span>
          <span class="min-w-0">{{ a.label }}</span>
          <ArrowRight class="ml-auto size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </NuxtLink>
        <div class="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="cards">
          <StatCard v-for="c in cards" :key="c.label" :label="c.label" :value="c.value" :detail="c.detail" :to="c.to" :flag="c.flag" />
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <AdminFigures v-for="g in panels" :key="g.title" :group="g" />
      </div>

      <div class="grid gap-4 xl:grid-cols-3">
        <AdminPanel title="Newest accounts" to="/app/admin/users" link-label="All users">
          <ul v-if="data.newest.length" class="flex flex-col text-[14px]">
            <li v-for="u in data.newest" :key="u.id" class="border-b border-dashed last:border-0" data-testid="newest">
              <NuxtLink :to="`/app/admin/users/${u.id}`" class="flex h-10 items-center gap-2 hover:text-foreground">
                <span class="flex min-w-0 flex-col leading-tight">
                  <span class="truncate font-medium">{{ u.email }}</span>
                  <span class="truncate text-[12px] text-muted-foreground">{{ u.business }}</span>
                </span>
                <span class="ml-auto shrink-0 font-mono text-[12px] text-muted-foreground" :title="new Date(u.created_at).toLocaleString()">{{ timeAgo(u.created_at) }}</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="py-2 text-[14px] text-muted-foreground">No accounts yet.</p>
        </AdminPanel>

        <AdminPanel title="Latest published" to="/app/admin/highreels?show=published" link-label="All Highreels">
          <ul v-if="data.latest_published.length" class="flex flex-col text-[14px]">
            <li v-for="h in data.latest_published" :key="h.id" class="border-b border-dashed last:border-0" data-testid="published">
              <NuxtLink :to="`/app/admin/users/${h.owner_id}?highreel=${h.id}`" class="flex h-10 items-center gap-2">
                <span class="flex min-w-0 flex-col leading-tight">
                  <span class="truncate font-medium">{{ h.name }}</span>
                  <span class="truncate text-[12px] text-muted-foreground">{{ h.business }}</span>
                </span>
                <span class="ml-auto shrink-0 text-right font-mono text-[12px] leading-tight text-muted-foreground" :title="h.published_at ? new Date(h.published_at).toLocaleString() : ''">
                  {{ fmt(h.live) }} customers<br>{{ timeAgo(h.published_at!) }}
                </span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="py-2 text-[14px] text-muted-foreground">Nothing published yet.</p>
        </AdminPanel>

        <AdminPanel title="Latest payments" to="/app/admin/payments" link-label="All payments">
          <ul v-if="data.latest_payments.length" class="flex flex-col text-[14px]">
            <li v-for="p in data.latest_payments" :key="p.id" class="border-b border-dashed last:border-0" data-testid="payment">
              <NuxtLink :to="`/app/admin/users/${p.owner_id}`" class="flex h-10 items-center gap-2">
                <span class="flex min-w-0 flex-col leading-tight">
                  <span class="truncate font-medium">{{ p.business }}</span>
                  <span class="truncate text-[12px] text-muted-foreground">{{ p.campaign ?? 'deleted Highreel' }}</span>
                </span>
                <span class="ml-auto shrink-0 text-right font-mono text-[12px] leading-tight text-muted-foreground" :title="new Date(p.paid_at).toLocaleString()">
                  <span class="text-[13px] text-foreground" :class="{ 'text-muted-foreground line-through': p.status === 'refunded' }">{{ formatAmount(p.amount, p.currency) }}</span><br>{{ timeAgo(p.paid_at) }}
                </span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="py-2 text-[14px] text-muted-foreground">No payments yet.</p>
        </AdminPanel>
      </div>
    </div>
  </AdminLoad>
</template>

<style scoped>
.alert {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 10px 16px;
  line-height: 1.35;
  border-radius: 14px;
  background: color-mix(in oklab, var(--shape-marigold) 16%, var(--background));
  font-size: 14px;
  transition: background-color 150ms ease;
}
.alert:hover { background: color-mix(in oklab, var(--shape-marigold) 24%, var(--background)); }
</style>
