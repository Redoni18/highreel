<script setup lang="ts">
// A realistic iPhone (17 Pro proportions) for the landing: a titanium band, a
// thin black bezel and the screen edge to edge, with the Dynamic Island, the
// status bar and the home indicator drawn over whatever fills it. Everything
// scales with the frame's width (container units). A recap in the slot gets
// --recap-inset-top, so its progress bar and content start below the status
// bar while its colour runs up behind it, like a page in Safari.
withDefaults(defineProps<{
  /** status bar and home indicator colour: light on dark screens, dark on light ones */
  ink?: string
  time?: string
}>(), { ink: '#FFFFFF', time: '9:41' })
</script>

<template>
  <div class="iphone">
    <span class="key action" aria-hidden="true" />
    <span class="key vol-up" aria-hidden="true" />
    <span class="key vol-down" aria-hidden="true" />
    <span class="key power" aria-hidden="true" />
    <span class="key camera" aria-hidden="true" />
    <div class="band">
      <div class="bezel">
        <div class="glass">
          <slot />
          <div class="status" :style="{ color: ink }" aria-hidden="true">
            <span class="time">{{ time }}</span>
            <span class="island" />
            <svg class="icons" viewBox="0 0 68 12">
              <rect x="0" y="8" width="3" height="4" rx="0.8" />
              <rect x="4.6" y="5.8" width="3" height="6.2" rx="0.8" />
              <rect x="9.2" y="3.4" width="3" height="8.6" rx="0.8" />
              <rect x="13.8" y="1" width="3" height="11" rx="0.8" />
              <path d="M29 3.2a10.6 10.6 0 0 1 7.6 3.1l1.3-1.3A12.4 12.4 0 0 0 29 1.3 12.4 12.4 0 0 0 20.1 5l1.3 1.3A10.6 10.6 0 0 1 29 3.2Zm0 3.6a7 7 0 0 1 5 2.1l1.3-1.3A8.8 8.8 0 0 0 29 5a8.8 8.8 0 0 0-6.3 2.6L24 8.9a7 7 0 0 1 5-2.1Zm0 3.6a3.4 3.4 0 0 1 2.4 1L29 13.8l-2.4-2.4a3.4 3.4 0 0 1 2.4-1Z" />
              <rect x="42.5" y="1" width="21.5" height="10.5" rx="3.2" fill="none" stroke="currentColor" stroke-opacity="0.4" stroke-width="1" />
              <rect x="44.3" y="2.8" width="15.4" height="6.9" rx="1.8" />
              <path d="M65.4 4.4v3.7c.8-.3 1.3-1 1.3-1.85S66.2 4.7 65.4 4.4Z" fill-opacity="0.45" />
            </svg>
          </div>
          <span class="home" :style="{ background: ink }" aria-hidden="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Proportions from a 402 × 874 pt screen: 92.6 units wide inside a 100-unit
   frame, 3.7 units of band and bezel. The screen's corners are a little
   tighter than Apple's, so the recap reads as a page rather than a pill. */
.iphone {
  position: relative;
  container-type: inline-size;
  aspect-ratio: 100 / 208.7;
}
.band {
  position: absolute;
  inset: 0;
  padding: 1.1cqw;
  border-radius: 14.4cqw;
  background: linear-gradient(135deg, #9A9AA0 0%, #3A3A3E 16%, #1D1D20 50%, #3A3A3E 84%, #9A9AA0 100%);
  box-shadow: inset 0 0 0 0.3cqw rgb(255 255 255 / 0.16), 0 3cqw 9cqw -3cqw rgb(0 0 0 / 0.55), 0 30px 60px -28px rgb(0 0 0 / 0.45);
}
.bezel {
  height: 100%;
  padding: 2.6cqw;
  border-radius: 13.3cqw;
  background: #050505;
}
.glass {
  --recap-inset-top: 13.4cqw;
  position: relative;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  border-radius: 10.7cqw;
  background: #000000;
}
.glass > :deep(:first-child) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.status {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  height: 12.4cqw;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
}
.time,
.icons {
  position: absolute;
  top: 6.75cqw;
  translate: 0 -50%;
}
.time {
  left: 0;
  width: 31.9cqw;
  font-size: 4.3cqw;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1;
  text-align: center;
}
.icons {
  right: 6.4cqw;
  width: 18.4cqw;
  height: 3.3cqw;
  fill: currentColor;
}
.island {
  position: absolute;
  top: 2.5cqw;
  left: 50%;
  width: 28.8cqw;
  height: 8.5cqw;
  translate: -50% 0;
  border-radius: 9999px;
  background: #000000;
}
.home {
  position: absolute;
  bottom: 1.9cqw;
  left: 50%;
  z-index: 10;
  width: 33cqw;
  height: 1.3cqw;
  translate: -50% 0;
  border-radius: 9999px;
  opacity: 0.85;
  pointer-events: none;
}
.key {
  position: absolute;
  width: 1cqw;
  border-radius: 0.6cqw;
  background: linear-gradient(90deg, #2A2A2E, #6E6E74 50%, #2A2A2E);
}
.action, .vol-up, .vol-down { left: -0.7cqw; }
.power, .camera { right: -0.7cqw; }
.action { top: 18%; height: 6.5%; }
.vol-up { top: 28%; height: 10%; }
.vol-down { top: 40%; height: 10%; }
.power { top: 30%; height: 15%; }
.camera { top: 60%; height: 8%; }
</style>
