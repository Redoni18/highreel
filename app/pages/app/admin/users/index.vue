<script setup lang="ts">
// The admin's users (SPEC M2.15): accounts, demo sessions or admins, one row
// each with what their business made, sent and paid. A row opens the user's
// page. The kind is in the URL (?kind=), the search stays on the page.
import { Search } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import type { AdminColumn } from '~/components/admin/AdminTable.vue'
import type { AdminUser, AdminUsers, UserKind } from '#shared/types/admin'
import { formatMoney, moneySize, percent } from '#shared/utils/admin'
import { timeAgo } from '#shared/utils/home'

useHead({ title: 'Users · Admin · Highreel' })
const route = useRoute()
const router = useRouter()
const kind = computed<UserKind>({
  get: () => (['demos', 'admins'].includes(String(route.query.kind)) ? route.query.kind as UserKind : 'accounts'),
  set: k => router.replace({ query: k === 'accounts' ? {} : { kind: k } }),
})
const { data, loading, error, load } = useAdminFetch<AdminUsers>(() => '/api/admin/users', () => ({ kind: kind.value }))

const search = ref('')
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  const users = data.value?.users ?? []
  return q ? users.filter(u => `${u.email ?? ''} ${u.business ?? ''} ${u.id}`.toLowerCase().includes(q)) : users
})
const kinds = computed(() => {
  const c = data.value?.counts
  const label = (k: UserKind, name: string) => (c ? `${name} ${c[k].toLocaleString('en-US')}` : name)
  return [
    { value: 'accounts' as const, label: label('accounts', 'Accounts') },
    { value: 'demos' as const, label: label('demos', 'Demos') },
    { value: 'admins' as const, label: label('admins', 'Admins') },
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
]
</script>

<template>
  <section class="flex flex-col gap-4" aria-labelledby="users-title">
    <div class="flex flex-wrap items-center gap-3">
      <h1 id="users-title" class="mr-2 text-[22px] font-semibold tracking-[-0.02em]">Users</h1>
      <Segmented v-model="kind" :options="kinds" label="Which users" />
      <div class="relative ml-auto w-full sm:w-72">
        <Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" type="search" aria-label="Search users" placeholder="Email, business or id" class="h-9 rounded-full pl-9" />
      </div>
    </div>
    <AdminLoad :loading="loading" :error="error" :ready="!!data" @retry="load">
      <AdminTable
        :columns="columns"
        :rows="shown"
        :row-key="u => u.id"
        :to="u => `/app/admin/users/${u.id}`"
        label="Users"
        :min-width="1320"
        :empty="search ? 'No user matches that.' : 'No users here yet.'"
      >
        <template #cell-email="{ row, value }">
          <NuxtLink :to="`/app/admin/users/${row.id}`" class="block max-w-[260px] truncate font-medium hover:underline" :class="{ 'text-muted-foreground': row.demo }" :title="row.email ?? row.id">{{ value }}</NuxtLink>
        </template>
        <template #cell-role="{ row }">
          <RoleBadge :role="row.role" />
        </template>
      </AdminTable>
      <p v-if="data?.more" class="text-[13px] text-muted-foreground">Showing the newest {{ data.users.length.toLocaleString('en-US') }}.</p>
    </AdminLoad>
  </section>
</template>
