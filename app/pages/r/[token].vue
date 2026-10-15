<script setup lang="ts">
// A recipient's recap (SPEC §5). Mobile-first and full-screen. On wider
// screens the 9:16 frame sits in the middle of the business's colours in
// motion (RecapBackdrop, M2.8), with previous / next beside it and pause
// under it. noindex, no third-party scripts: the only requests are the
// payload and our own event counters.
import type RecapPlayer from '~/components/recap/RecapPlayer.vue'
import type { RecapEventType, RecapPayload } from '#shared/types/recap'
import { templateFor } from '#shared/templates'
import { resolveLook } from '#shared/templates/designs'
import { mix } from '#shared/utils/color'
import { shareTexts } from '#shared/utils/slides'

definePageMeta({ layout: false })

const route = useRoute()
const token = computed(() => String(route.params.token ?? ''))

const { data, error } = await useFetch<RecapPayload>(() => `/api/r/${token.value}`, {
  key: () => `recap-${token.value}`,
})
if (import.meta.server && error.value) {
  const event = useRequestEvent()
  if (event)
    setResponseStatus(event, error.value.statusCode ?? 404)
}

const texts = computed(() => data.value ? shareTexts(templateFor(data.value.template_key, data.value.settings), data.value) : null)
const title = computed(() => texts.value?.title ?? 'Highreel not found')
// The page wears the Highreel's look (SPEC M2.17).
const look = computed(() => (data.value ? resolveLook(data.value.settings.look) : null))
const accent = computed(() => look.value?.accent ?? '#0a0a0a')
const paper = computed(() => look.value?.theme === 'paper')

// Link previews in WhatsApp, iMessage, Slack… (SPEC M2g). Absolute URLs.
const origin = useRequestURL().origin
useSeoMeta({
  ogTitle: title,
  ogDescription: () => texts.value?.description,
  ogImage: () => data.value ? `${origin}/api/r/${token.value}/og.png` : undefined,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogType: 'website',
  twitterCard: 'summary_large_image',
})

useHead({
  title,
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
    { name: 'theme-color', content: () => accent.value },
  ],
  bodyAttrs: {
    class: 'recap-page',
    // The page behind the frame on wide screens (the backdrop's own colour).
    style: () => data.value ? `--page: ${paper.value ? mix(accent.value, '#F4F1EA', 0.07) : mix(accent.value, '#FFFFFF', 0.13)}` : '',
  },
})

function track(type: RecapEventType) {
  if (!data.value)
    return
  fetch(`/api/r/${token.value}/event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type }),
    keepalive: true,
  }).catch(() => {})
}

onMounted(() => track('view'))

const player = ref<InstanceType<typeof RecapPlayer> | null>(null)
</script>

<template>
  <main class="stage">
    <template v-if="data">
      <RecapBackdrop class="backdrop" :accent="accent" :paper="paper" />
      <div class="viewer">
        <button type="button" class="nav" aria-label="Previous slide" :disabled="!player || player.index === 0" @click="player?.prev()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div class="column">
          <RecapPlayer ref="player" class="frame" :payload="data" mode="live" @event="track" />
          <div class="bar">
            <button type="button" class="pause" :aria-pressed="player?.paused ?? false" data-testid="pause" @click="player && (player.paused = !player.paused)">
              <svg v-if="player?.paused" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" class="fill" /></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13M15.5 5.5v13" /></svg>
              {{ player?.paused ? 'Play' : 'Pause' }}
            </button>
            <span v-if="player" class="count" data-testid="count">{{ player.index + 1 }} / {{ player.count }}</span>
          </div>
        </div>
        <button type="button" class="nav" aria-label="Next slide" :disabled="!player || player.index >= player.count - 1" @click="player?.next()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </template>
    <div v-else class="missing">
      <p class="font-mono text-xs opacity-60">{{ error?.statusCode ?? 404 }}</p>
      <h1 class="text-xl font-semibold tracking-tight">This Highreel isn't available.</h1>
      <p class="text-sm opacity-70">The link may be mistyped, or the business has taken it down.</p>
    </div>
  </main>
</template>

<style>
body.recap-page {
  background: #0a0a0a;
  color: #fafafa;
  overscroll-behavior: none;
}
@media (min-width: 640px) and (min-aspect-ratio: 3/4) {
  body.recap-page { background: var(--page, #0a0a0a); }
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
.backdrop,
.nav,
.bar {
  display: none;
}
.missing {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 320px;
  padding: 24px;
  text-align: center;
}

/* Wide screens: the frame in the middle, controls around it. */
@media (min-width: 640px) and (min-aspect-ratio: 3/4) {
  .backdrop { display: block; }
  .viewer {
    position: relative;
    display: flex;
    align-items: center;
    gap: clamp(16px, 3vw, 40px);
  }
  .column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .frame {
    height: min(100dvh - 104px, 900px);
    width: auto;
    aspect-ratio: 9 / 16;
    border-radius: 22px;
    box-shadow: 0 30px 70px -24px rgb(0 0 0 / 0.45), 0 0 0 1px rgb(0 0 0 / 0.06);
  }
  .nav,
  .pause {
    color: #222222;
    background: #FFFFFF;
    box-shadow: 0 6px 18px -6px rgb(0 0 0 / 0.25), 0 0 0 1px rgb(0 0 0 / 0.05);
    transition: transform 150ms ease, opacity 150ms ease;
  }
  .nav {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 9999px;
  }
  .nav:hover:not(:disabled), .pause:hover { transform: scale(1.06); }
  .nav:active:not(:disabled), .pause:active { transform: scale(0.97); }
  .nav:disabled { opacity: 0.35; cursor: default; }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--font-sans);
  }
  .pause {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 18px 0 14px;
    border-radius: 9999px;
    font-size: 14px;
    font-weight: 600;
  }
  .count {
    min-width: 52px;
    padding: 0 12px;
    height: 28px;
    line-height: 28px;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.7);
    color: #222222;
    font-family: var(--font-mono);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .pause svg { width: 16px; height: 16px; }
  .pause svg .fill { fill: currentColor; stroke-width: 1.5; }
}
</style>
