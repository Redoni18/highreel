<script setup lang="ts">
// The business's mark: its logo filling a circle or a rounded square (Your
// brand's logo shape, SPEC M2.6), otherwise the initial letter in the same
// shape. No frame: the logo is the mark; white shows only through a
// transparent logo.
import type { LogoShape } from '#shared/types/recap'

const props = defineProps<{ name: string, bg: string, fg: string, size: string, logoUrl?: string | null, shape?: LogoShape }>()
const initial = computed(() => (props.name.trim()[0] ?? 'R').toUpperCase())
const radius = computed(() => (props.shape === 'square' ? `calc(${props.size} * 0.22)` : '50%'))
</script>

<template>
  <span
    v-if="logoUrl"
    class="inline-block shrink-0 overflow-hidden bg-white select-none"
    :style="{ width: size, height: size, borderRadius: radius }"
    aria-hidden="true"
  >
    <img :src="logoUrl" alt="" class="block size-full object-cover" draggable="false">
  </span>
  <span
    v-else
    class="inline-grid shrink-0 place-items-center font-bold leading-none select-none"
    :style="{ background: bg, color: fg, width: size, height: size, borderRadius: radius, fontSize: `calc(${size} * 0.5)` }"
    aria-hidden="true"
  >{{ initial }}</span>
</template>
