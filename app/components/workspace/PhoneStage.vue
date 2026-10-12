<script setup lang="ts">
// The phone beside an editor (Design, Your brand; SPEC M2.8): the recap in
// the landing's iPhone frame on a tint of the business's colour, with
// previous · slide n/N · next · play under it. The page drives it through
// the exposed player (jump to the slide being edited, read its keys).
import { ChevronLeft, ChevronRight, Pause, Play } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type RecapPlayer from '~/components/recap/RecapPlayer.vue'
import type { RecapPayload } from '#shared/types/recap'

const props = defineProps<{
  payload: RecapPayload | null
  accent: string
  /** status-bar ink until the player says what the slide's text colour is */
  ink: string
}>()

const player = ref<InstanceType<typeof RecapPlayer> | null>(null)
const tone = computed(() => player.value?.tone?.fg ?? props.ink)
defineExpose({ player })
</script>

<template>
  <aside class="stage relative hidden w-[min(36vw,440px)] shrink-0 flex-col items-center justify-center gap-4 border-l px-6 lg:flex" :style="{ '--accent': accent }" aria-label="Highlight reel preview">
    <PhoneFrame v-if="payload" class="phone" :ink="tone">
      <RecapPlayer ref="player" :payload="payload" mode="preview" :autoplay="false" />
    </PhoneFrame>
    <div v-if="payload && player" class="flex items-center gap-1 text-[12px]">
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous slide" :disabled="player.index === 0" @click="player.prev()"><ChevronLeft /></Button>
      <span class="w-20 text-center font-mono text-[11px] text-muted-foreground tabular-nums" data-testid="stage-count">slide {{ player.index + 1 }}/{{ player.count }}</span>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Next slide" :disabled="player.index >= player.count - 1" @click="player.next()"><ChevronRight /></Button>
      <Button type="button" size="icon-sm" class="ml-2 bg-foreground text-background hover:bg-foreground/85" :aria-label="player.playing ? 'Pause' : 'Play'" @click="player.playing = !player.playing">
        <Pause v-if="player.playing" class="size-3.5" />
        <Play v-else class="size-3.5" />
      </Button>
    </div>
    <p v-if="$slots.default" class="max-w-[300px] text-center text-[12px] text-muted-foreground">
      <slot />
    </p>
  </aside>
</template>

<style scoped>
.stage {
  background: color-mix(in oklab, var(--accent) 10%, var(--subtle));
  transition: background-color 300ms ease;
}
.phone {
  width: min(290px, calc((100dvh - 210px) * 0.479));
  font-family: var(--font-sans);
}
</style>
