<script setup lang="ts">
// count (SPEC M2.5 P1): odometer digits roll into place while small tokens
// drop from above and stack at the bottom. Up to ~60 tokens; above that each
// one stands for a round number, shown as "● = 20". Tokens are squares and
// circles, or (M2.7) all dots, hearts or stars, picked per slide in Design.
import type { SceneProps } from '~/lib/recap'
import { mix } from '#shared/utils/color'
import { formatNumber } from '#shared/utils/slides'
import { bigSizeU, seeded, stepTimes, tokenPlan } from '#shared/utils/scenes'

const props = defineProps<SceneProps>()

const value = computed(() => Math.max(0, props.slide.value ?? 0))
const plan = computed(() => tokenPlan(value.value))
// Fewer tokens, bigger tokens: the pile always reads as a pile (84u wide).
const grid = computed(() => {
  const n = plan.value.count
  const cols = n <= 8 ? 4 : n <= 18 ? 6 : n <= 32 ? 8 : 10
  const pitch = 84 / cols
  return { cols, pitch, size: pitch * 0.76 }
})
const second = computed(() => mix(props.tone.fg, props.tone.bg, 0.55))
const shape = computed(() => props.slide.tokens ?? 'shapes')

const tokens = computed(() => {
  const rand = seeded(`count|${props.slide.key}|${value.value}`)
  const times = stepTimes(plan.value.count, 1900, 650)
  const { cols, pitch, size } = grid.value
  return times.map((t, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const coin = rand() < 0.5
    return {
      key: i,
      // Seeded either way, so the pile lands the same whichever shape is picked.
      cls: shape.value === 'shapes' ? (coin ? 'round' : '') : shape.value,
      colour: rand() < 0.72 ? props.tone.hi : second.value,
      style: {
        'left': `calc(${(col * pitch + (rand() - 0.5) * pitch * 0.18).toFixed(2)} * var(--u))`,
        'bottom': `calc(${(row * size * 1.04).toFixed(2)} * var(--u))`,
        'width': `calc(${size.toFixed(2)} * var(--u))`,
        'height': `calc(${size.toFixed(2)} * var(--u))`,
        'rotate': `${Math.round((rand() - 0.5) * 40)}deg`,
        '--t': `${t}ms`,
      },
    }
  })
})

const chars = computed(() => formatNumber(value.value).length + (props.slide.prefix?.length ?? 0) + (props.slide.suffix?.length ?? 0))
const bigSize = computed(() => `calc(${bigSizeU(chars.value).toFixed(1)} * var(--u))`)
</script>

<template>
  <div class="s-body count">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>
    <p class="big rise" style="--d: 120ms" :style="{ fontSize: bigSize, color: tone.hi }">
      <span v-if="slide.prefix">{{ slide.prefix }}</span><Odometer :value="value" :delay="220" /><span v-if="slide.suffix">{{ slide.suffix }}</span>
    </p>
    <p v-if="slide.after" class="s-line rise" style="--d: 220ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 1700ms">{{ slide.small }}</p>

    <div class="pile" aria-hidden="true">
      <span v-if="plan.unit > 1" class="legend fade-in" style="--d: 2400ms"><i class="mini" :class="shape === 'shapes' ? 'dots' : shape" :style="{ background: tone.hi }" /> = {{ formatNumber(plan.unit) }}</span>
      <span
        v-for="t in tokens"
        :key="t.key"
        class="token"
        :class="t.cls"
        :style="[t.style, { background: t.colour }]"
      />
    </div>
  </div>
</template>

<style scoped>
.count {
  justify-content: flex-start;
  padding-top: calc(26 * var(--u));
}
.big { margin: calc(2 * var(--u)) 0 calc(2 * var(--u)); }
.pile {
  position: absolute;
  left: calc(8 * var(--u));
  right: calc(8 * var(--u));
  bottom: calc(18 * var(--u));
  height: calc(46 * var(--u));
}
.token {
  position: absolute;
  border-radius: 22%;
  animation: drop 760ms var(--ease-drop) both;
  animation-delay: var(--t);
}
.token.round,
.token.dots { border-radius: 50%; }
.hearts,
.stars {
  border-radius: 0 !important;
  -webkit-mask: var(--mask) center / contain no-repeat;
  mask: var(--mask) center / contain no-repeat;
}
.hearts { --mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 21.6S1.8 15.4 1.8 8.4C1.8 5 4.3 2.6 7.3 2.6c2 0 3.6 1 4.7 2.6 1.1-1.6 2.7-2.6 4.7-2.6 3 0 5.5 2.4 5.5 5.8 0 7-10.2 13.2-10.2 13.2Z'/%3E%3C/svg%3E"); }
.stars { --mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='m12 1.5 3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L12 18l-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1Z'/%3E%3C/svg%3E"); }
@keyframes drop {
  from { transform: translateY(-120cqh) rotate(-90deg); }
}
.legend {
  position: absolute;
  right: 0;
  top: calc(-6 * var(--u));
  display: inline-flex;
  align-items: center;
  gap: calc(1.2 * var(--u));
  font-family: var(--font-mono);
  font-size: calc(3.4 * var(--u));
  font-weight: 500;
  opacity: 0.8;
}
.legend .mini {
  display: inline-block;
  width: calc(2.6 * var(--u));
  height: calc(2.6 * var(--u));
}
.legend .mini.dots { border-radius: 50%; }
</style>
