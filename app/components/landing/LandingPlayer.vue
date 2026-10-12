<script setup lang="ts">
// The landing's example phone lazy-loads this wrapper (LazyLandingPlayer)
// rather than the recap player itself. A lazy import of RecapPlayer makes its
// chunk build a module namespace with Rolldown's runtime helper, and the
// bundler puts that helper in whichever chunk it likes: once it was a
// workspace chunk, and every recap (/r) downloaded 21 KB of menus and
// tailwind-merge for it (SPEC M2.7, §7.6 budgets). The player is exposed as is.
import type { RecapPayload } from '#shared/types/recap'
import RecapPlayer from '~/components/recap/RecapPlayer.vue'

defineProps<{ payload: RecapPayload }>()
const player = ref<InstanceType<typeof RecapPlayer> | null>(null)
defineExpose({ player })
</script>

<template>
  <RecapPlayer ref="player" :payload="payload" mode="preview" :autoplay="false" />
</template>
