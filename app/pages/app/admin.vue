<script setup lang="ts">
// The admin pages (SPEC M2.15): the whole service, for accounts with the
// admin role. Overview, Users (and a page per user), Highreels and Payments
// as tabs, each its own page underneath (pages/app/admin/). Read-only: they
// show accounts and counts, never a business's sheets. The middleware sends
// anyone else home, and every admin route checks the role again.
import { ArrowLeft } from '@lucide/vue'
import { Button } from '@/components/ui/button'

useHead({ title: 'Admin · Highreel' })
const route = useRoute()
const tabs = [
  { to: '/app/admin', label: 'Overview' },
  { to: '/app/admin/users', label: 'Users' },
  { to: '/app/admin/highreels', label: 'Highreels' },
  { to: '/app/admin/payments', label: 'Payments' },
]
// Users stays lit on a user's page.
const here = computed(() => tabs.findLast(t => route.path === t.to || (t.to !== '/app/admin' && route.path.startsWith(`${t.to}/`)))?.to)
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-3 py-1.5">
      <NuxtLink to="/app" class="wordmark" aria-label="Your Highreels" title="Your Highreels"><Wordmark /></NuxtLink>
      <span class="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      <span class="rounded-full bg-foreground px-2.5 py-0.5 text-[12px] font-semibold tracking-wide text-background uppercase">Admin</span>
      <nav class="order-last flex w-full items-center gap-0.5 overflow-x-auto rounded-full bg-muted p-0.5 sm:order-none sm:mx-auto sm:w-auto" aria-label="Admin">
        <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab" :aria-current="here === t.to ? 'page' : undefined">{{ t.label }}</NuxtLink>
      </nav>
      <Button variant="ghost" size="sm" class="ml-auto px-3 text-[14px] sm:ml-0" as-child>
        <NuxtLink to="/app"><ArrowLeft /> Your Highreels</NuxtLink>
      </Button>
    </header>
    <main class="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-10 px-4 pt-10 pb-16 md:px-8">
      <NuxtPage />
    </main>
  </div>
</template>

<style scoped>
.wordmark {
  flex: none;
  padding: 0 4px;
  border-radius: 9999px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 32px;
}
.tab {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 14px;
  border-radius: 9999px;
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 500;
  transition: background-color 150ms ease, color 150ms ease;
}
.tab:hover { color: var(--foreground); background: color-mix(in oklab, var(--background) 70%, transparent); }
.tab[aria-current='page'] { background: var(--foreground); color: var(--background); }
</style>
