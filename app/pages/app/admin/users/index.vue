<script setup lang="ts">
// The admin's users (SPEC M2.15): accounts, demo sessions or admins, one row
// each with what their business made, sent and paid, and a "⋯" menu to block
// or remove it; or the blocked addresses, to unblock. A row opens the user's
// page. The kind is in the URL (?kind=), the search stays on the page.
import { Search } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import type { AdminColumn } from '~/components/admin/AdminTable.vue'
import type { AdminUser, AdminUsers, BlockedAddress, UserKind } from '#shared/types/admin'
import { formatMoney, moneySize, percent } from '#shared/utils/admin'
import { timeAgo } from '#shared/utils/home'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'

useHead({ title: 'Users · Admin · Highreel' })
const route = useRoute()
const router = useRouter()
const kind = computed<UserKind>({
  get: () => (['demos', 'admins', 'blocked'].includes(String(route.query.kind)) ? route.query.kind as UserKind : 'accounts'),
  set: k => router.replace({ query: k === 'accounts' ? {} : { kind: k } }),
})
const { data, loading, error, load } = useAdminFetch<AdminUsers>(() => '/api/admin/users', () => ({ kind: kind.value }))

const search = ref('')
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  const users = data.value?.users ?? []
  return q ? users.filter(u => `${u.email ?? ''} ${u.business ?? ''} ${u.id}`.toLowerCase().includes(q)) : users
})
const shownBlocked = computed(() => {
  const q = search.value.trim().toLowerCase()
  const blocked = data.value?.blocked ?? []
  return q ? blocked.filter(b => `${b.email} ${b.reason ?? ''}`.toLowerCase().includes(q)) : blocked
})
const kinds = computed(() => {
  const c = data.value?.counts
  const label = (k: UserKind, name: string) => (c ? `${name} ${c[k].toLocaleString('en-US')}` : name)
  return [
    { value: 'accounts' as const, label: label('accounts', 'Accounts') },
    { value: 'demos' as const, label: label('demos', 'Demos') },
    { value: 'admins' as const, label: label('admins', 'Admins') },
    { value: 'blocked' as const, label: label('blocked', 'Blocked') },
  ]
})

const when = (iso: string | null) => (iso ? timeAgo(iso) : null)
const columns: AdminColumn<AdminUser>[] = [
  { key: 'email', label: 'Account', value: u => u.email ?? `Demo ${u.id.slice(0, 6)}` },
  { key: 'business', label: 'Business', value: u => u.business },
  { key: 'role', label: 'Role', value: u => u.role },
  { key: 'created', label: 'Signed up', value: u => when(u.created_at), sort: u => u.created_at },
  { key: 'seen', label: 'Last seen', value: u => when(u.last_seen), sort: u => u.last_seen, title: 'The latest session\'s last use, to the day' },
  { key: 'highreels', label: 'Highreels', value: u => u.highreels, num: true },
  { key: 'published', label: 'Published', value: u => u.published, num: true },
  { key: 'unpaid', label: 'Not paid', value: u => u.unpaid, num: true, title: 'Published Highreels without a payment' },
  { key: 'live', label: 'Customers', value: u => u.live, num: true, title: 'Customers\' Highreels with a link' },
  { key: 'opened', label: 'Opened', value: u => (u.live ? `${u.opened.toLocaleString('en-US')} · ${percent(u.opened, u.live)}` : null), sort: u => u.opened, num: true },
  { key: 'shared', label: 'Shared', value: u => u.shared, num: true },
  { key: 'emails', label: 'Emails', value: u => u.emails, num: true, title: 'Highreel emails sent from their own account' },
  { key: 'payments', label: 'Payments', value: u => u.payments, num: true },
  { key: 'spent', label: 'Spent', value: u => (u.payments ? formatMoney(u.spent) : null), sort: u => moneySize(u.spent), num: true },
  { key: 'actions', label: 'Actions', value: () => null, fixed: true },
]
const blockedColumns: AdminColumn<BlockedAddress>[] = [
  { key: 'email', label: 'Address', value: b => b.email },
  { key: 'account', label: 'Account', value: b => (b.user_id ? 'open account' : 'removed'), sort: b => (b.user_id ? 0 : 1) },
  { key: 'reason', label: 'Note', value: b => b.reason },
  { key: 'created', label: 'Blocked', value: b => timeAgo(b.created_at), sort: b => b.created_at },
  { key: 'by', label: 'By', value: b => b.blocked_by },
  { key: 'actions', label: 'Actions', value: () => null, fixed: true },
]
const { api, fail } = useApi()
async function unblock(email: string) {
  try {
    await api<{ ok: boolean }>('/api/admin/unblock', { method: 'POST', body: { email } })
    toast(`Unblocked ${email}`)
    load()
  }
  catch (e) {
    fail('Couldn\'t unblock it', e)
  }
}
</script>

<template>
  <section class="flex flex-col gap-4" aria-labelledby="users-title">
    <div class="flex flex-wrap items-center gap-3">
      <h1 id="users-title" class="mr-2 text-[22px] font-semibold tracking-[-0.02em]">Users</h1>
      <!-- With four-figure counts the pills outgrow a phone: they scroll in their own box, not the page. -->
      <div class="max-w-full overflow-x-auto [scrollbar-width:none]">
        <Segmented v-model="kind" :options="kinds" label="Which users" />
      </div>
      <div class="relative ml-auto w-full sm:w-72">
        <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" type="search" aria-label="Search users" :placeholder="kind === 'blocked' ? 'Address or note' : 'Email, business or id'" class="h-9 rounded-full pl-9" />
      </div>
    </div>
    <AdminLoad :loading="loading" :error="error" :ready="!!data && data.kind === kind" @retry="load">
      <AdminTable
        v-if="kind === 'blocked'"
        :columns="blockedColumns"
        :rows="shownBlocked"
        :row-key="b => b.email"
        label="Blocked addresses"
        :min-width="900"
        :empty="search ? 'No address matches that.' : 'No blocked addresses.'"
        sort-key="created"
      >
        <template #cell-email="{ value }">
          <span class="block max-w-[300px] truncate font-medium" :title="String(value)">{{ value }}</span>
        </template>
        <template #cell-account="{ row }">
          <NuxtLink v-if="row.user_id" :to="`/app/admin/users/${row.user_id}`" class="underline-offset-4 hover:underline">Open account</NuxtLink>
          <span v-else class="text-muted-foreground">removed</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end">
            <Button variant="outline" size="sm" class="h-7 px-3 text-[13px]" data-testid="unblock" @click="unblock(row.email)">Unblock</Button>
          </div>
        </template>
      </AdminTable>
      <AdminTable
        v-else
        :columns="columns"
        :rows="shown"
        :row-key="u => u.id"
        :to="u => `/app/admin/users/${u.id}`"
        label="Users"
        :min-width="1240"
        :empty="search ? 'No user matches that.' : 'No users here yet.'"
      >
        <template #cell-email="{ row, value }">
          <span class="flex min-w-0 items-center gap-2">
            <NuxtLink :to="`/app/admin/users/${row.id}`" class="block max-w-[260px] truncate font-medium hover:underline" :class="{ 'text-muted-foreground': row.demo }" :title="row.email ?? row.id">{{ value }}</NuxtLink>
            <BlockedBadge v-if="row.blocked" />
          </span>
        </template>
        <template #cell-role="{ row }">
          <RoleBadge :role="row.role" />
        </template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end">
            <AdminUserActions :user="row" @changed="load" @removed="load" />
          </div>
        </template>
      </AdminTable>
      <p v-if="data?.more" class="text-[13px] text-muted-foreground">Showing the newest {{ data.users.length.toLocaleString('en-US') }}.</p>
    </AdminLoad>
  </section>
</template>
