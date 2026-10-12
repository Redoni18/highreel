<script setup lang="ts">
// Landing, step 3: members get their recap. On three phones a notification
// from "Your business" lands on the lock screen, gets tapped, and that
// person's recap cover floods open in their business's colour. CSS loop,
// staggered per phone; the base style is the end state (every recap open),
// so reduced motion shows three open recaps.
const members = [
  { name: 'Ana', bg: '#4F46E5', fg: '#FFFFFF' },
  { name: 'Leon', bg: '#E2457A', fg: '#FFFFFF' },
  { name: 'Dea', bg: '#F5C518', fg: '#1A1A1A' },
]
</script>

<template>
  <div class="v-share" aria-hidden="true">
    <div class="v-inner">
      <PhoneFrame v-for="(m, i) in members" :key="m.name" class="ph" :class="`ph-${i}`" :style="{ '--i': i }" :ink="m.fg">
        <div class="scr">
          <div class="lock">
            <p class="date">Monday 7 December</p>
            <p class="clock">9:41</p>
            <div class="note">
              <span class="app"><LandingShape kind="scallop" class="app-shape" /></span>
              <span class="note-body">
                <span class="note-top"><b>Your business</b><span>now</span></span>
                <span class="note-text">{{ m.name }}, your 2026 reel is here</span>
              </span>
            </div>
          </div>
          <span class="flood" :style="{ background: m.bg }" />
          <div class="cover" :style="{ color: m.fg }">
            <span class="bars"><span v-for="n in 6" :key="n" /></span>
            <span class="mark" :style="{ background: m.fg, color: m.bg }"><LandingShape kind="scallop" class="mark-shape" /></span>
            <span class="kicker">Your business · 2026</span>
            <span class="title">{{ m.name }}, your 2026</span>
          </div>
        </div>
      </PhoneFrame>
    </div>
  </div>
</template>

<style scoped>
.v-share {
  --T: 8s;
  container-type: inline-size;
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
}
/* A container's own cqw would resolve against its parent, so sizes live one level in. */
.v-inner {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 4cqw;
  background: color-mix(in srgb, currentColor 7%, transparent);
}
.ph {
  position: absolute;
  top: 11cqw;
  width: 25.5cqw;
}
.ph-0 { left: 8cqw; rotate: -4deg; }
.ph-1 { left: 37.25cqw; top: 6cqw; }
.ph-2 { left: 66.5cqw; rotate: 4deg; }

/* Inside each phone, cqw is that phone's width. */
.scr {
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
}
.lock {
  position: absolute;
  inset: 0;
  background: linear-gradient(170deg, #C9D6FF 0%, #E7D4F7 48%, #FBE2CF 100%);
  color: #1A1A2E;
  text-align: center;
}
.date {
  margin-top: 17cqw;
  font-size: 5.6cqw;
  font-weight: 600;
  opacity: 0.75;
}
.clock {
  font-size: 27cqw;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.note {
  position: absolute;
  left: 5cqw;
  right: 5cqw;
  top: 108cqw;
  display: flex;
  gap: 3.4cqw;
  align-items: center;
  padding: 4cqw;
  border-radius: 7cqw;
  background: rgb(255 255 255 / 0.82);
  box-shadow: 0 2cqw 6cqw -2cqw rgb(0 0 0 / 0.25);
  text-align: left;
  opacity: 0;
  animation: v-note var(--T) var(--ease-out, ease-out) calc(var(--i) * 0.6s) infinite both;
}
.app {
  display: grid;
  flex: none;
  place-items: center;
  width: 12cqw;
  height: 12cqw;
  border-radius: 3cqw;
  background: #4560FF;
  color: #FFFFFF;
}
.app-shape { width: 7.5cqw; height: 7.5cqw; }
.note-body { min-width: 0; flex: 1; line-height: 1.2; }
.note-top {
  display: flex;
  justify-content: space-between;
  font-size: 5cqw;
}
.note-top span { opacity: 0.5; }
.note-text {
  display: block;
  font-size: 5cqw;
}
.flood {
  position: absolute;
  left: 50%;
  top: 60%;
  width: 260%;
  aspect-ratio: 1;
  border-radius: 50%;
  translate: -50% -50%;
  animation: v-flood var(--T) var(--ease-out, ease-out) calc(var(--i) * 0.6s) infinite both;
}
.cover {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: 16cqw 9cqw 15cqw;
  font-family: var(--font-sans);
  animation: v-cover var(--T) linear calc(var(--i) * 0.6s) infinite both;
}
.bars {
  display: flex;
  gap: 1.4cqw;
}
.bars span {
  flex: 1;
  height: 0.9cqw;
  border-radius: 9999px;
  background: currentColor;
  opacity: 0.35;
}
.bars span:first-child { opacity: 1; }
.mark {
  display: grid;
  place-items: center;
  width: 17cqw;
  height: 17cqw;
  margin-top: 8cqw;
  border-radius: 50%;
}
.mark-shape { width: 10cqw; height: 10cqw; }
.kicker {
  margin-top: auto;
  font-size: 5cqw;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.title {
  margin-top: 3cqw;
  font-size: 15cqw;
  font-weight: 700;
  line-height: 1.02;
  letter-spacing: -0.03em;
}

/* the notification drops in, waits, gets tapped; then the recap floods open and stays */
@keyframes v-note {
  0%, 6% { opacity: 0; transform: translateY(-14cqw) scale(0.94); }
  13% { opacity: 1; transform: none; }
  38% { opacity: 1; transform: none; }
  41% { opacity: 1; transform: scale(0.95); }
  46%, 100% { opacity: 0; transform: scale(0.95); }
}
@keyframes v-flood {
  0%, 41% { transform: scale(0); opacity: 1; }
  52%, 93% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}
@keyframes v-cover {
  0%, 47% { opacity: 0; }
  55%, 93% { opacity: 1; }
  100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .v-share *, .v-share *::before, .v-share *::after { animation: none !important; }
}
</style>
