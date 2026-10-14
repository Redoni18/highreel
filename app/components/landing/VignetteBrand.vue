<script setup lang="ts">
// Landing, step 2 (SPEC M2.5 P2): picking a swatch floods the recap's cover
// with that colour. CSS loop through three accents; at rest it shows the first.
const swatches = ['#4F46E5', '#C8341B', '#1F6F4A', '#F5C518']
</script>

<template>
  <div class="v-brand" aria-hidden="true">
    <div class="v-inner">
    <PhoneFrame class="mini">
      <div class="mini-screen">
        <span class="layer" :style="{ background: swatches[0] }" />
        <span class="layer"><span class="flood f1" :style="{ background: swatches[1] }" /></span>
        <span class="layer"><span class="flood f2" :style="{ background: swatches[2] }" /></span>
        <span class="disc" />
        <div class="mini-body">
          <span class="mark"><LandingShape kind="scallop" class="mark-shape" /></span>
          <p class="mini-kicker">Your business · 2026</p>
          <p class="mini-title">Ana, your 2026 with us</p>
        </div>
      </div>
    </PhoneFrame>

    <div class="controls">
      <p class="label">Accent colour</p>
      <div class="swatches">
        <span v-for="c in swatches" :key="c" class="sw" :style="{ background: c }" />
        <span class="ring" />
      </div>
      <p class="label">Theme</p>
      <div class="themes">
        <span class="theme on">Stories</span>
        <span class="theme">Paper</span>
      </div>
      <p class="label">Cover</p>
      <p class="field">{first_name}, your {year} with {business}</p>
    </div>
    </div>
  </div>
</template>

<style scoped>
.v-brand {
  --T: 9s;
  container-type: inline-size;
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
}
/* A container's own cqw would resolve against its parent, so sizes live one level in. */
.v-inner {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 34% 1fr;
  gap: 7cqw;
  align-items: center;
  padding: 5cqw 7cqw;
  border-radius: 4cqw;
  background: color-mix(in srgb, currentColor 7%, transparent);
}
/* Inside the phone, cqw is the phone's width. */
.mini-screen {
  color: #FFFFFF;
}
.layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.flood {
  position: absolute;
  left: 100%;
  top: 40%;
  /* wide enough to reach the far corner (bottom left, 1.64 screen widths away) */
  width: 360%;
  aspect-ratio: 1;
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0);
}
.f1 { animation: v-flood-1 var(--T) var(--ease-out, ease-out) infinite; }
.f2 { animation: v-flood-2 var(--T) var(--ease-out, ease-out) infinite; }
.disc {
  position: absolute;
  top: -12%;
  right: -30%;
  width: 90%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.14);
}
.mini-body {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 19cqw 12cqw 16cqw;
}
.mark {
  display: grid;
  place-items: center;
  width: 22cqw;
  height: 22cqw;
  border-radius: 50%;
  background: #FFFFFF;
  color: #0A0A0A;
}
.mark-shape { width: 13cqw; height: 13cqw; }
.mini-kicker {
  margin-top: auto;
  font-size: 6.4cqw;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.mini-title {
  margin-top: 4.4cqw;
  font-size: 16.5cqw;
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.03em;
}
.label {
  margin-bottom: 1.8cqw;
  font-family: var(--font-mono);
  font-size: 2.8cqw;
}
.label:not(:first-child) { margin-top: 4.4cqw; }
.swatches {
  position: relative;
  display: flex;
  gap: 2.6cqw;
}
.sw {
  width: 8cqw;
  height: 8cqw;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.25);
}
.ring {
  position: absolute;
  left: -1.1cqw;
  top: -1.1cqw;
  width: 10.2cqw;
  height: 10.2cqw;
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.7cqw currentColor;
  animation: v-ring var(--T) var(--ease-out, ease-out) infinite;
}
.themes { display: flex; gap: 1.6cqw; }
.theme {
  padding: 1.2cqw 2.6cqw;
  border-radius: 1.6cqw;
  font-size: 3cqw;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 30%, transparent);
}
.theme.on { box-shadow: inset 0 0 0 0.5cqw currentColor; font-weight: 600; }
.field {
  padding: 1.8cqw 2.4cqw;
  border-radius: 1.6cqw;
  background: color-mix(in srgb, currentColor 10%, transparent);
  font-family: var(--font-mono);
  font-size: 2.6cqw;
  line-height: 1.4;
}

/* swatch 1 → 2 at a third of the loop, 2 → 3 at two thirds, then back */
@keyframes v-flood-1 {
  0%, 31% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
  39%, 94% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}
@keyframes v-flood-2 {
  0%, 64% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
  72%, 94% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}
/* the ring hops between swatches (8cqw + 2.6cqw gap apart) and presses */
@keyframes v-ring {
  0%, 26% { transform: translateX(0); }
  29% { transform: translateX(0) scale(0.86); }
  32%, 59% { transform: translateX(10.6cqw); }
  62% { transform: translateX(10.6cqw) scale(0.86); }
  65%, 93% { transform: translateX(21.2cqw); }
  97%, 100% { transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .v-brand *, .v-brand *::before, .v-brand *::after { animation: none !important; }
}
</style>
