<script setup lang="ts">
// The admin pages (SPEC M2.15): the whole service, for accounts with the
// admin role. A sidebar on the left like the example pages' (owner,
// 2026-10-13), each section its own page on the right (pages/app/admin/); on
// phones the sidebar is a row on top. They show accounts and counts, never a
// business's sheets, and can block or remove an account. The middleware sends
// anyone else home, and every admin route checks the role again.
import { CreditCard, Film, LayoutGrid, Users } from '@lucide/vue'

useHead({ title: 'Admin · Highreel' })
const route = useRoute()
const sections = [
  { to: '/app/admin', label: 'Overview', icon: LayoutGrid },
  { to: '/app/admin/users', label: 'Users', icon: Users },
  { to: '/app/admin/highreels', label: 'Highreels', icon: Film },
  { to: '/app/admin/payments', label: 'Payments', icon: CreditCard },
]
// Users stays lit on a user's page.
const here = computed(() => sections.findLast(t => route.path === t.to || (t.to !== '/app/admin' && route.path.startsWith(`${t.to}/`)))?.to)
</script>

<template>
  <div class="admin">
    <aside class="side">
      <NuxtLink to="/app" class="back">← Your Highreels</NuxtLink>
      <p class="side-title"><Wordmark still /> <span class="side-badge">Admin</span></p>
      <nav class="nav" aria-label="Admin">
        <NuxtLink v-for="s in sections" :key="s.to" :to="s.to" :aria-current="here === s.to ? 'page' : undefined">
          <component :is="s.icon" class="size-4 shrink-0" aria-hidden="true" />{{ s.label }}
        </NuxtLink>
      </nav>
    </aside>
    <main class="flex min-w-0 flex-1 flex-col gap-10 px-4 pt-6 pb-16 md:px-8 md:pt-9">
      <NuxtPage />
    </main>
  </div>
</template>

<style scoped>
.admin {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
.side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border);
}
.back {
  order: 2;
  margin-left: auto;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 13px;
}
.back:hover { color: var(--foreground); }
.side-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 28px;
}
.side-badge {
  padding: 1px 8px;
  border-radius: 9999px;
  background: var(--foreground);
  color: var(--background);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 18px;
  text-transform: uppercase;
}
.nav {
  order: 3;
  display: flex;
  width: 100%;
  gap: 2px;
  overflow-x: auto;
}
.nav a {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--muted-foreground);
  font-size: 14px;
  font-weight: 500;
  transition: background-color 150ms ease, color 150ms ease;
}
.nav a:hover { background: var(--subtle); color: var(--foreground); }
/* On phones the four fit in a row without their icons. */
.nav a :deep(svg) { display: none; }
.nav a[aria-current='page'] { background: var(--muted); color: var(--foreground); font-weight: 600; }

/* From tablets up: a column on the left that stays put while the page scrolls. */
@media (min-width: 768px) {
  .admin { flex-direction: row; }
  .side {
    position: sticky;
    top: 0;
    flex: none;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 0;
    width: 220px;
    height: 100dvh;
    padding: 24px 14px;
    border-right: 1px solid var(--border);
    border-bottom: 0;
  }
  .back { order: 0; margin-left: 0; }
  .side-title { margin-top: 18px; }
  .nav a :deep(svg) { display: block; }
  .nav {
    order: 0;
    flex-direction: column;
    margin: 18px -4px 0;
    width: auto;
    overflow: visible;
  }
}
</style>
