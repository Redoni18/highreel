<script setup lang="ts">
// badge (SPEC M2.5 P1): a rosette seal spins in with ribbons, then a light
// sweeps across it. The badge text sits inside, with the business above and
// the year below, like a real medal.
import type { SceneProps } from '~/lib/recap'
import { mix, readableOn } from '#shared/utils/color'

const props = defineProps<SceneProps>()

const text = computed(() => props.slide.text ?? '')
const seal = computed(() => props.tone.hi)
const ink = computed(() => readableOn(seal.value))
const ribbon = computed(() => mix(seal.value, props.tone.bg, 0.62))
const textSize = computed(() => {
  const n = text.value.length
  return `calc(${n <= 8 ? 8.4 : n <= 14 ? 6.8 : n <= 24 ? 5.4 : 4.4} * var(--u))`
})

// A 24-point rosette edge.
const rosette = (() => {
  const pts: string[] = []
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const r = i % 2 ? 46 : 50
    pts.push(`${(50 + r * Math.sin(a)).toFixed(2)}% ${(50 - r * Math.cos(a)).toFixed(2)}%`)
  }
  return `polygon(${pts.join(', ')})`
})()
</script>

<template>
  <div class="s-body badge">
    <p v-if="slide.before" class="s-line rise" style="--d: 80ms">{{ slide.before }}</p>

    <div class="medal">
      <span class="ribbon left" :style="{ background: ribbon }" aria-hidden="true" />
      <span class="ribbon right" :style="{ background: ribbon }" aria-hidden="true" />
      <div class="spin">
        <div class="seal" :style="{ background: seal, color: ink, clipPath: rosette }">
          <span class="dashed" aria-hidden="true" />
          <span class="seal-top" aria-hidden="true">{{ payload.business.name }}</span>
          <span class="seal-text" :style="{ fontSize: textSize }">{{ text }}</span>
          <span class="seal-year" aria-hidden="true">{{ payload.year }}</span>
          <span class="shine" aria-hidden="true" />
        </div>
      </div>
    </div>

    <p v-if="slide.after" class="s-line rise" style="--d: 1400ms">{{ slide.after }}</p>
    <p v-if="slide.small" class="s-small rise" style="--d: 1600ms">{{ slide.small }}</p>
  </div>
</template>

<style scoped>
.badge {
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: calc(4 * var(--u));
}
.medal {
  position: relative;
  width: calc(66 * var(--u));
  height: calc(66 * var(--u));
  margin: calc(4 * var(--u)) 0 calc(10 * var(--u));
  perspective: calc(160 * var(--u));
}
.spin {
  position: absolute;
  inset: 0;
  animation: spin-in 1400ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both;
}
@keyframes spin-in {
  from { opacity: 0; transform: rotateY(-720deg) scale(0.15); }
  15% { opacity: 1; }
}
.theme-paper .spin { animation-name: spin-in-calm; }
@keyframes spin-in-calm {
  from { opacity: 0; transform: rotateY(-180deg) scale(0.6); }
}
.seal {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(2 * var(--u));
  padding: calc(11 * var(--u)) calc(10 * var(--u));
  overflow: hidden;
}
.dashed {
  position: absolute;
  inset: calc(6.5 * var(--u));
  border-radius: 50%;
  border: max(1px, calc(0.6 * var(--u))) dashed currentColor;
  opacity: 0.4;
}
.seal-top,
.seal-year {
  font-family: var(--font-mono);
  font-size: calc(2.9 * var(--u));
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.75;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.seal-text {
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.03em;
  text-wrap: balance;
  overflow-wrap: anywhere;
}
.shine {
  position: absolute;
  inset: -10%;
  background: linear-gradient(105deg, transparent 38%, rgb(255 255 255 / 0.55) 50%, transparent 62%);
  transform: translateX(130%);
  animation: shine 2600ms ease-in-out 1500ms 2 backwards;
}
@keyframes shine {
  0% { transform: translateX(-130%); }
  40%, 100% { transform: translateX(130%); }
}
.ribbon {
  position: absolute;
  top: 58%;
  width: calc(15 * var(--u));
  height: calc(34 * var(--u));
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%);
  transform-origin: top center;
  animation: ribbon 800ms var(--ease-pop) 1250ms both;
}
.ribbon.left { left: 26%; rotate: 22deg; }
.ribbon.right { right: 26%; rotate: -22deg; }
@keyframes ribbon {
  from { opacity: 0; transform: scaleY(0.2); }
}
</style>
