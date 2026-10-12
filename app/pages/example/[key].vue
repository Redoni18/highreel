<script setup lang="ts">
// An example recap, full-screen like a real one (SPEC M2.5 P2): "Open it
// full screen" under the landing's phone opens it. Static payloads from app/data/examples,
// no requests, no counters. The last slide's button leads to the demo.
import { findExample, EXAMPLES, withDemoButton } from '~/data/examples'

definePageMeta({ layout: false })

const route = useRoute()
const origin = useRequestURL().origin
const example = computed(() => findExample(String(route.params.key ?? '')))
if (!example.value)
  throw createError({ statusCode: 404, statusMessage: 'Example not found', fatal: true })

const payload = computed(() => withDemoButton(example.value!.payload, origin))
const business = computed(() => payload.value.business.name)

// Search and link previews name the public site (SPEC M2.11).
useCanonical(`/example/${example.value!.key}`)
useSeoMeta({
  title: () => `Example: ${business.value}'s highlight reel · Highreel`,
  description: () => `${example.value!.about}. An example of a highlight reel made with Highreel.`,
  ogTitle: () => `Example: ${business.value}'s highlight reel`,
  ogDescription: () => `${example.value!.about}. An example of a highlight reel made with Highreel.`,
  ogSiteName: 'Highreel',
  ogType: 'website',
  ogImage: siteHref('/og.png'),
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
})
useHead({
  meta: [{ name: 'theme-color', content: () => payload.value.business.accent_color }],
  bodyAttrs: { class: 'recap-page' },
})
</script>

<template>
  <main class="stage">
    <RecapPlayer :key="example!.key" class="frame" :payload="payload" mode="live" />
    <aside class="side" aria-label="About this example">
      <NuxtLink to="/" class="back">← highreel</NuxtLink>
      <p class="side-title">An example highlight reel</p>
      <p class="side-about">{{ example!.about }}. Tap or use the arrow keys.</p>
      <nav class="others" aria-label="Other examples">
        <NuxtLink v-for="e in EXAMPLES" :key="e.key" :to="`/example/${e.key}`" :aria-current="e.key === example!.key ? 'page' : undefined">
          <span class="dot" :style="{ background: e.payload.business.accent_color }" />{{ e.label }}
        </NuxtLink>
      </nav>
      <NuxtLink to="/login?demo=1" class="demo">Try the demo →</NuxtLink>
    </aside>
  </main>
</template>

<style>
body.recap-page {
  background: #0a0a0a;
  color: #fafafa;
  overscroll-behavior: none;
}
</style>

<style scoped>
.stage {
  min-height: 100dvh;
  display: grid;
  place-items: center;
}
.frame {
  width: 100vw;
  height: 100dvh;
}
.side { display: none; }
@media (min-width: 900px) and (min-aspect-ratio: 3/4) {
  .stage {
    grid-template-columns: auto 240px;
    justify-content: center;
    gap: 40px;
  }
  .frame {
    height: min(100dvh - 48px, 960px);
    width: auto;
    aspect-ratio: 9 / 16;
    border-radius: 20px;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 14px;
    font-size: 14px;
  }
}
.back {
  font-family: var(--font-mono);
  font-size: 13px;
  opacity: 0.7;
  text-decoration: none;
}
.back:hover { opacity: 1; }
.side-title {
  margin-top: 18px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
}
.side-about { opacity: 0.75; }
.others {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
}
.others a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  margin-left: -10px;
  border-radius: 8px;
  text-decoration: none;
  opacity: 0.75;
}
.others a:hover { opacity: 1; background: rgb(255 255 255 / 0.06); }
.others a[aria-current='page'] { opacity: 1; font-weight: 600; background: rgb(255 255 255 / 0.1); }
.dot { width: 10px; height: 10px; border-radius: 50%; }
.demo {
  align-self: flex-start;
  margin-top: 10px;
  padding: 10px 16px;
  border-radius: 9999px;
  background: #fafafa;
  color: #0a0a0a;
  font-weight: 600;
  text-decoration: none;
}
</style>
