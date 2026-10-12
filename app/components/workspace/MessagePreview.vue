<script setup lang="ts">
// What one person gets, on a phone (Share, SPEC M2.9): the email open in a
// mail app, or the message in a chat with its link preview. A picture, not a
// way in: nothing in it responds to clicks (the email's links are switched
// off inside the frame), so the preview can't turn into the recap itself.
import { mix, readableOn } from '#shared/utils/color'

const props = defineProps<{
  channel: 'email' | 'chat'
  business: { name: string, accent_color: string }
  /** who it's for */
  person: string
  /** the email: its subject and HTML */
  email?: { subject: string, html: string }
  /** the chat message, with its link */
  message?: string
  /** the link preview card under the chat message */
  card?: { image: string | null, title: string, site: string } | null
}>()

const initial = (s: string) => s.trim().charAt(0).toUpperCase() || '·'
const accent = computed(() => props.business.accent_color)
const onAccent = computed(() => readableOn(accent.value))

// The email is laid out for a real phone (402 pt wide) and scaled to the frame.
const wrap = ref<HTMLElement | null>(null)
const scale = ref(0.72)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([e]) => {
    if (e)
      scale.value = e.contentRect.width / 402
  })
  if (wrap.value)
    observer.observe(wrap.value)
})
onBeforeUnmount(() => observer?.disconnect())
const srcdoc = computed(() => (props.email?.html ?? '').replace('</head>', '<style>a{pointer-events:none!important;cursor:default!important}html,body{overscroll-behavior:none}</style></head>'))

// The message's link in blue, like a chat app shows it.
const parts = computed(() => (props.message ?? '').split(/(https?:\/\/\S+)/g).map((text, i) => ({ text, link: i % 2 === 1 })))
</script>

<template>
  <div class="screen" :class="channel" aria-hidden="true">
    <template v-if="channel === 'email'">
      <div class="mail-bar"><span class="back">‹ Inbox</span></div>
      <div class="mail-head">
        <div class="flex items-center gap-[2.6cqw]">
          <span class="avatar" :style="{ background: accent, color: onAccent }">{{ initial(business.name) }}</span>
          <div class="min-w-0 flex-1">
            <p class="from">{{ business.name }}</p>
            <p class="to">To: {{ person }}</p>
          </div>
          <span class="when">Now</span>
        </div>
        <p class="subject" data-testid="mail-subject">{{ email?.subject }}</p>
      </div>
      <div ref="wrap" class="mail-body">
        <iframe :srcdoc="srcdoc" title="Email preview" sandbox="" tabindex="-1" :style="{ width: `${100 / scale}%`, height: `${100 / scale}%`, transform: `scale(${scale})` }" />
      </div>
    </template>

    <template v-else>
      <div class="chat-bar">
        <span class="back">‹</span>
        <span class="avatar grey">{{ initial(person) }}</span>
        <p class="name">{{ person }}</p>
      </div>
      <div class="chat-body" :style="{ '--wall': mix(accent, '#EFE7DD', 0.04) }">
        <div class="bubble" data-testid="chat-bubble">
          <div v-if="card" class="card">
            <img v-if="card.image" :src="card.image" alt="" class="card-img">
            <div class="card-text">
              <p class="card-title">{{ card.title }}</p>
              <p class="card-site">{{ card.site }}</p>
            </div>
          </div>
          <p class="text"><template v-for="(p, i) in parts" :key="i"><span v-if="p.link" class="link">{{ p.text }}</span><template v-else>{{ p.text }}</template></template></p>
          <p class="meta">9:41 <span class="ticks">✓✓</span></p>
        </div>
      </div>
      <div class="chat-input"><span>Message</span></div>
    </template>
  </div>
</template>

<style scoped>
.screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding-top: var(--recap-inset-top, 13.4cqw);
  overflow: hidden;
  background: #FFFFFF;
  color: #111111;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  pointer-events: none;
  user-select: none;
}
.back { color: #0A7AFF; font-size: 4.4cqw; }
.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 9.5cqw;
  height: 9.5cqw;
  border-radius: 50%;
  font-size: 4.2cqw;
  font-weight: 700;
}
.avatar.grey { background: #C9CED6; color: #FFFFFF; }

/* Mail */
.mail-bar { padding: 1.5cqw 4.5cqw 2cqw; }
.mail-head {
  display: flex;
  flex-direction: column;
  gap: 2.6cqw;
  padding: 0 4.5cqw 3.4cqw;
  border-bottom: 1px solid #E8E8E8;
}
.from { font-size: 4.1cqw; font-weight: 600; }
.to, .when { color: #8A8A8E; font-size: 3.3cqw; }
.subject { font-size: 4.8cqw; font-weight: 700; line-height: 1.25; }
.mail-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.mail-body iframe {
  position: absolute;
  top: 0;
  left: 0;
  border: 0;
  transform-origin: top left;
  /* It scrolls like a mail app; its links are switched off inside. */
  pointer-events: auto;
}

/* Chat */
.chat-bar {
  display: flex;
  align-items: center;
  gap: 2.4cqw;
  padding: 1cqw 4cqw 2.6cqw;
  border-bottom: 1px solid #E2E2E2;
  background: #F7F7F7;
}
.chat-bar .back { font-size: 7cqw; line-height: 1; }
.chat-bar .avatar { width: 8.5cqw; height: 8.5cqw; font-size: 3.8cqw; }
.name { font-size: 4.2cqw; font-weight: 600; }
.chat-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  padding: 4cqw 3cqw;
  background: var(--wall);
}
.bubble {
  align-self: flex-end;
  max-width: 86%;
  padding: 1.2cqw;
  border-radius: 3.6cqw 3.6cqw 1cqw 3.6cqw;
  background: #D9FDD3;
  box-shadow: 0 0.3cqw 0.6cqw rgb(0 0 0 / 0.08);
}
.card {
  overflow: hidden;
  margin-bottom: 1.4cqw;
  border-radius: 2.6cqw;
  background: rgb(0 0 0 / 0.05);
}
.card-img { display: block; width: 100%; aspect-ratio: 1200 / 630; object-fit: cover; }
.card-text { padding: 1.8cqw 2.4cqw 2.2cqw; }
.card-title { font-size: 3.4cqw; font-weight: 600; line-height: 1.3; }
.card-site { color: #667781; font-size: 3cqw; }
.text {
  padding: 0 1.6cqw;
  font-size: 3.8cqw;
  line-height: 1.38;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.link { color: #027EB5; }
.meta {
  padding: 0.6cqw 1.6cqw 0.4cqw;
  color: #667781;
  font-size: 2.8cqw;
  text-align: right;
}
.ticks { color: #53BDEB; letter-spacing: -0.6cqw; }
.chat-input {
  padding: 2.4cqw 3cqw 9cqw;
  background: #F7F7F7;
}
.chat-input span {
  display: block;
  padding: 2.2cqw 3.6cqw;
  border-radius: 9999px;
  background: #FFFFFF;
  color: #A0A0A0;
  font-size: 3.6cqw;
  box-shadow: inset 0 0 0 1px #E2E2E2;
}
</style>
