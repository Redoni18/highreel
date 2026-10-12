<script setup lang="ts">
// Workspace, sign-in and confirm pages. Toasts and tooltips live here rather
// than in app.vue, so recap pages and the landing don't load them. The app's
// type follows the landing (Outfit, handwritten notes); it's set on <body>
// so dialogs, menus and toasts (portalled there) get it too. Recaps in the
// preview keep their own font (RecapPlayer sets Geist).
import 'vue-sonner/style.css'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

useHead({ bodyAttrs: { class: 'app-ui' } })
</script>

<template>
  <LandingShapes />
  <TooltipProvider :delay-duration="300">
    <slot />
  </TooltipProvider>
  <Toaster position="bottom-center" :toast-options="{ classes: { toast: 'rounded-2xl text-[13px]' } }" />
</template>

<style>
/* Caveat, cut down to printable ASCII (scripts/subset-caveat.py, OFL); same file as the landing's notes */
@font-face {
  font-family: 'Recap Notes';
  src: url('/fonts/caveat-notes.woff2') format('woff2');
  font-display: swap;
}
body.app-ui {
  font-family: 'Outfit', var(--font-sans);
}
body.app-ui :focus-visible {
  outline-color: var(--ring);
}
/* A handwritten aside, like the landing's "step one" notes: 22 px and up only. */
.note-hand {
  font-family: 'Recap Notes', cursive;
  font-weight: 400;
  line-height: 1.1;
  color: var(--muted-foreground);
}
</style>
