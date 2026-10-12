<script setup lang="ts">
// A business-type template as a tiny recap cover: its colour (or the
// business's, in Design) and theme, a mark, two title lines. Used by the
// template pickers (New recap, Design).
import type { Starter } from '#shared/templates/starters'
import { readableOn } from '#shared/utils/color'

const props = defineProps<{ starter: Starter, accent?: string }>()
const colour = computed(() => props.accent ?? props.starter.accent)
const paper = computed(() => props.starter.theme === 'paper')
const bg = computed(() => (paper.value ? '#F4F1EA' : colour.value))
const fg = computed(() => (paper.value ? '#1A1A1A' : readableOn(colour.value)))
</script>

<template>
  <span class="swatch" :style="{ background: bg, color: fg, '--accent': colour }" aria-hidden="true">
    <span class="bars"><i v-for="n in 4" :key="n" /></span>
    <span class="mark" :class="{ paper }" />
    <span class="line l1" />
    <span class="line l2" />
    <span v-if="paper" class="rule" />
  </span>
</template>

<style scoped>
.swatch {
  position: relative;
  display: block;
  flex: none;
  container-type: inline-size;
  aspect-ratio: 9 / 16;
  overflow: hidden;
  border-radius: 7px;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.07);
}
.bars {
  position: absolute;
  top: 7cqw;
  left: 8cqw;
  right: 8cqw;
  display: flex;
  gap: 3cqw;
}
.bars i {
  flex: 1;
  height: 3cqw;
  min-height: 1px;
  border-radius: 9999px;
  background: currentColor;
  opacity: 0.35;
}
.bars i:first-child { opacity: 0.9; }
.mark {
  position: absolute;
  top: 18cqw;
  left: 10cqw;
  width: 22cqw;
  height: 22cqw;
  border-radius: 50%;
  background: currentColor;
}
.mark.paper { background: var(--accent); }
.line {
  position: absolute;
  left: 10cqw;
  height: 11cqw;
  border-radius: 3cqw;
  background: currentColor;
}
.l1 { bottom: 40cqw; width: 74cqw; }
.l2 { bottom: 25cqw; width: 52cqw; }
.rule {
  position: absolute;
  left: 10cqw;
  bottom: 15cqw;
  width: 30cqw;
  height: 4cqw;
  background: var(--accent);
}
</style>
