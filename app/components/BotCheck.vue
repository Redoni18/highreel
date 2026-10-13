<script setup lang="ts">
// Cloudflare Turnstile, the bot check on signing in (SPEC M2.14 P3): the demo
// and email links need its token. Its script loads when this mounts (/login)
// or on first use (`lazy`: the demo banner, where most people never use it).
// Usually it decides without showing anything; if Cloudflare wants a click,
// the widget appears where this sits. `token()` gives a fresh one-time token.
// Locally the site key is Turnstile's test key, which always passes.

interface Turnstile {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  execute: (widget: string) => void
  reset: (widget: string) => void
  remove: (widget: string) => void
}

const props = defineProps<{ lazy?: boolean }>()
const el = ref<HTMLElement>()
const sitekey = String(useRuntimeConfig().public.turnstileSiteKey || '')
const turnstile = () => (window as { turnstile?: Turnstile }).turnstile

let widget: string | undefined
let used = false
let waiting: { resolve: (token: string) => void, reject: (e: Error) => void } | null = null

let script: Promise<void> | undefined
function load(): Promise<void> {
  if (turnstile())
    return Promise.resolve()
  script ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      script = undefined
      s.remove()
      reject(new Error('The sign-in check didn\'t load. Check your connection (or a content blocker), then try again.'))
    }
    document.head.append(s)
  })
  return script
}

function settle(token: string | null, error?: string) {
  const w = waiting
  waiting = null
  if (token)
    w?.resolve(token)
  else
    w?.reject(new Error(error ?? 'The sign-in check didn\'t finish. Try again.'))
}

/** Render the widget once; its id. */
async function mount(): Promise<string> {
  if (!sitekey)
    throw new Error('No Turnstile site key (NUXT_PUBLIC_TURNSTILE_SITE_KEY)')
  await load()
  if (widget !== undefined)
    return widget
  if (!el.value)
    throw new Error('The sign-in check isn\'t on the page any more. Reload and try again.')
  widget = turnstile()!.render(el.value, {
    'sitekey': sitekey,
    'execution': 'execute',
    'appearance': 'interaction-only',
    'callback': (token: string) => settle(token),
    'error-callback': () => {
      settle(null)
      return true
    },
    'expired-callback': () => settle(null),
    'timeout-callback': () => settle(null, 'The sign-in check timed out. Try again.'),
  })
  return widget
}

async function token(): Promise<string> {
  const id = await mount()
  if (used)
    turnstile()!.reset(id)
  used = true
  settle(null)
  return new Promise<string>((resolve, reject) => {
    waiting = { resolve, reject }
    turnstile()!.execute(id)
  })
}

onMounted(() => {
  if (!props.lazy)
    mount().catch(() => {})
})
onBeforeUnmount(() => {
  if (widget !== undefined)
    turnstile()?.remove(widget)
})

defineExpose({ token })
</script>

<template>
  <div ref="el" class="flex justify-center empty:hidden" />
</template>
