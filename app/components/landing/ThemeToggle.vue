<script setup lang="ts">
// Light or dark, on the landing, terms, privacy and sign-in: the same setting as
// the account menu's Dark mode (@nuxtjs/color-mode, kept in this browser), so the
// app follows it too. Its script puts `dark` on <html> before the first paint;
// which icon shows is CSS on that class, so the prerendered HTML is right before
// any script runs. The new look grows as a circle from the button (a view
// transition) where the browser has them and motion is welcome; otherwise it
// switches at once.
import { Moon, Sun } from '@lucide/vue'

const colorMode = useColorMode()
const button = ref<HTMLButtonElement | null>(null)
// Set once mounted: the prerendered HTML can't know the setting.
const dark = ref<boolean | null>(null)
onMounted(() => {
  dark.value = document.documentElement.classList.contains('dark')
})

function apply(next: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', next === 'dark')
  root.classList.toggle('light', next === 'light')
  colorMode.preference = next
  dark.value = next === 'dark'
}

function toggle() {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches || !button.value) {
    apply(next)
    return
  }
  const r = button.value.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const root = document.documentElement
  root.classList.add('theme-switch')
  const t = document.startViewTransition(() => apply(next))
  t.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${reach}px at ${x}px ${y}px)`] },
      { duration: 700, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  }).catch(() => {})
  t.finished.finally(() => root.classList.remove('theme-switch'))
}
</script>

<template>
  <button
    ref="button"
    type="button"
    class="theme-toggle"
    aria-label="Dark mode"
    :aria-pressed="dark ?? undefined"
    data-testid="theme-toggle"
    @click="toggle"
  >
    <Moon class="icon moon" aria-hidden="true" />
    <Sun class="icon sun" aria-hidden="true" />
  </button>
</template>

<style scoped>
.theme-toggle {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  /* the page's own background where it sets one (it sits over the hero's shapes) */
  background: var(--surface, transparent);
  color: inherit;
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, currentColor 22%, transparent);
  cursor: pointer;
  transition: transform 180ms cubic-bezier(0.25, 1.35, 0.45, 1), box-shadow 160ms ease;
}
.theme-toggle:hover {
  box-shadow: inset 0 0 0 1.5px currentColor;
  transform: scale(1.05);
}
.theme-toggle:active { transform: scale(0.94); }
.theme-toggle:focus-visible {
  outline: 2px solid #4560FF;
  outline-offset: 3px;
}
.icon {
  grid-area: 1 / 1;
  width: 18px;
  height: 18px;
  stroke-width: 2;
}
/* Light: the moon (switch to dark). Dark: the sun. */
.sun { display: none; }
:global(.dark .theme-toggle .moon) { display: none; }
:global(.dark .theme-toggle .sun) { display: block; }
@media (prefers-reduced-motion: reduce) {
  .theme-toggle { transition: none; }
}
</style>
