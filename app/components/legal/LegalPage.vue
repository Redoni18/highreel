<script setup lang="ts">
// The terms and privacy pages (SPEC M2.12): the landing's look (Outfit, ink,
// the blue for links), one readable column, the sections listed at the top.
// Prerendered like the landing and served without waiting on scripts.
import { CONTACT_EMAIL, LEGAL_NAME, LEGAL_UPDATED, type LegalSection } from '~/data/legal'

defineProps<{ title: string, intro: string, sections: LegalSection[] }>()
</script>

<template>
  <div class="legal">
    <header class="nav">
      <NuxtLink to="/" class="wordmark"><Wordmark /></NuxtLink>
      <div class="nav-actions">
        <ThemeToggle />
        <NuxtLink to="/app" class="pill">Sign in</NuxtLink>
      </div>
    </header>

    <main class="doc">
      <h1>{{ title }}</h1>
      <p class="updated">Last updated {{ LEGAL_UPDATED }}</p>
      <p class="intro">{{ intro }}</p>

      <nav class="toc" aria-label="On this page">
        <p class="toc-title">On this page</p>
        <ol>
          <li v-for="s in sections" :key="s.id"><a :href="`#${s.id}`">{{ s.title }}</a></li>
        </ol>
      </nav>

      <slot />
    </main>

    <footer class="foot">
      <p class="foot-mark">
        <NuxtLink to="/" class="wordmark small"><Wordmark still /></NuxtLink>
        <span>© 2026 {{ LEGAL_NAME }}</span>
      </p>
      <nav class="foot-links" aria-label="Footer">
        <NuxtLink to="/terms">Terms</NuxtLink>
        <NuxtLink to="/privacy">Privacy</NuxtLink>
        <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>
      </nav>
    </footer>
  </div>
</template>

<style>
body.legal-page { background: #FFFFFF; }
.dark body.legal-page { background: #121212; }
</style>

<style scoped>
.legal {
  --surface: #FFFFFF;
  --ink: #222222;
  --ink-hover: #000000;
  --muted: #6F6F6F;
  --line: #E7E7E7;
  --box: #F4F4F4;
  --cta: #4560FF;
  /* Text links: a deeper blue than the buttons', 4.5:1 or more on the grey boxes too (5.5:1; 6.1:1 on white). */
  --link: #3B4FE6;
  min-height: 100dvh;
  background: var(--surface);
  color: var(--ink);
  font-family: 'Outfit', var(--font-sans);
  font-size: 1.0625rem;
  line-height: 1.6;
}
/* Dark (ThemeToggle): the landing's dark values. Links a lighter blue: 7.7:1 on
   the page, 6.9:1 on the boxes. */
:global(.dark .legal) {
  --surface: #121212;
  --ink: #F2F2F2;
  --ink-hover: #FFFFFF;
  --muted: #A3A3A3;
  --line: #2C2C2C;
  --box: #1E1E1E;
  --link: #8FA0FF;
  color-scheme: dark;
}
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 76px;
  padding-inline: 20px;
}
@media (min-width: 720px) {
  .nav { padding-inline: 40px; }
}
.wordmark {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.035em;
  text-decoration: none;
}
.wordmark.small { font-size: 17px; color: var(--ink); }
/* The landing's header buttons (pages/index.vue). */
.nav-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pill {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 18px;
  border-radius: 9999px;
  background: var(--ink);
  color: var(--surface);
  font-size: 15px;
  font-weight: 500;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  transition: transform 180ms cubic-bezier(0.25, 1.35, 0.45, 1), background-color 160ms ease;
}
.pill:hover { background: var(--ink-hover); transform: scale(1.03); }
.pill:active { transform: scale(0.97); }
@media (max-width: 379px) {
  .nav-actions { gap: 6px; }
  .pill { padding: 0 14px; }
}

.doc {
  max-width: 44rem;
  margin: 0 auto;
  padding: 32px 20px 72px;
}
.doc h1 {
  font-size: clamp(2.4rem, 6vw, 3.5rem);
  font-weight: 600;
  line-height: 1.05;
  letter-spacing: -0.03em;
}
.updated { margin-top: 14px; color: var(--muted); font-size: 15px; font-weight: 500; }
.intro { margin-top: 22px; font-size: 1.2rem; line-height: 1.5; }

.toc {
  margin: 32px 0 8px;
  padding: 20px 24px;
  border-radius: 20px;
  background: var(--box);
}
.toc-title { font-size: 14px; font-weight: 600; color: var(--muted); }
.toc ol {
  margin-top: 8px;
  padding-left: 1.3em;
  list-style: decimal;
  columns: 2 14rem;
  column-gap: 32px;
  font-size: 15px;
}
/* No top margin (the prose's li rule): a column break would drop it and misalign the columns. */
.doc .toc li { break-inside: avoid; margin-top: 0; padding: 3px 0; }

.doc :deep(h2) {
  margin-top: 48px;
  scroll-margin-top: 24px;
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.doc :deep(h3) {
  margin-top: 28px;
  font-size: 1.15rem;
  font-weight: 600;
}
.doc :deep(p),
.doc :deep(ul) { margin-top: 14px; }
.doc :deep(ul) { padding-left: 1.3em; list-style: disc; }
.doc :deep(li) { margin-top: 6px; }
.doc :deep(li::marker) { color: var(--muted); }
.doc :deep(strong) { font-weight: 600; }
.doc :deep(a),
.toc a {
  color: var(--link);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.doc :deep(a:hover), .toc a:hover { text-decoration-thickness: 2px; }
/* The footer's links read like the landing's: grey, underlined on hover. */
.foot-links a { color: inherit; text-decoration: none; }
.foot-links a:hover {
  color: var(--ink);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.doc :deep(.box) {
  margin-top: 18px;
  padding: 18px 22px;
  border-radius: 20px;
  background: var(--box);
}
.doc :deep(.box ul) { margin-top: 8px; }
.doc :deep(a:focus-visible), .toc a:focus-visible, .foot a:focus-visible, .nav a:focus-visible {
  outline: 2px solid var(--cta);
  outline-offset: 3px;
  border-radius: 4px;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px 32px;
  margin: 0 20px;
  padding: 22px 0 32px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
}
@media (min-width: 720px) {
  .foot { margin-inline: 40px; }
}
@media (max-width: 719px) {
  .foot { flex-direction: column-reverse; align-items: flex-start; }
}
.foot-mark {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.foot-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 24px;
}
@media (prefers-reduced-motion: reduce) {
  .pill { transition: none; }
}
</style>
