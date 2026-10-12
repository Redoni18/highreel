<script setup lang="ts">
// Landing, step 1 (SPEC M2.5 P2): a sheet's rows slide in, one cell is
// flagged red, gets fixed in place, and every row turns green. CSS loop;
// the base style is the finished sheet (reduced motion shows it still).
const rows = [
  { name: 'Ana', days: '212', streak: '41' },
  { name: 'Kai', days: '148', streak: '2' },
  { name: 'Clara', days: '91', bad: '9l', streak: '9' },
  { name: 'Liam', days: '301', streak: '88' },
  { name: 'Mia', days: '177', streak: '12' },
]
</script>

<template>
  <div class="v-sheet" aria-hidden="true">
    <div class="v-inner">
    <p class="v-top">
      <span class="v-swap">
        <span class="before">5 rows · 4 ready · <b>1 needs fixing</b></span>
        <span class="after">5 rows · 5 ready</span>
      </span>
    </p>
    <div class="v-table">
      <div class="v-row v-head">
        <span>#</span><span /><span>first_name</span><span class="num">active_days</span><span class="num">streak</span>
      </div>
      <div v-for="(r, i) in rows" :key="r.name" class="v-row" :style="{ '--i': i }">
        <span class="n">{{ i + 1 }}</span>
        <span class="dot" :class="{ late: r.bad }"><span class="ok" /></span>
        <span>{{ r.name }}</span>
        <span v-if="r.bad" class="num cell bad">
          <span class="bad-v">{{ r.bad }}</span>
          <span class="good-v">{{ r.days }}</span>
        </span>
        <span v-else class="num">{{ r.days }}</span>
        <span class="num">{{ r.streak }}</span>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.v-sheet {
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
  padding: 6cqw;
  border-radius: 4cqw;
  background: color-mix(in srgb, currentColor 7%, transparent);
  font-size: 3.6cqw;
}
.v-top {
  height: 6cqw;
  margin-bottom: 3cqw;
  font-family: var(--font-mono);
  font-size: 3.1cqw;
}
.v-swap { position: relative; display: block; }
.v-swap > span { position: absolute; left: 0; top: 0; white-space: nowrap; }
.v-swap b { font-weight: 600; color: var(--v-warn, #FFA79D); }
.before { opacity: 0; animation: v-early var(--T) linear infinite; }
.after { animation: v-late var(--T) linear infinite; }
.v-table {
  border-radius: 2.4cqw;
  overflow: hidden;
  background: #FFFFFF;
  color: #0A0A0A;
}
.v-row {
  display: grid;
  grid-template-columns: 7% 7% 1fr 27% 19%;
  align-items: center;
  height: 8.6cqw;
  padding: 0 3cqw;
  border-top: 1px solid #ECECEC;
  animation: v-row-in var(--T) var(--ease-out, ease-out) infinite;
  animation-delay: calc(var(--i) * 140ms);
}
.v-head {
  height: 8cqw;
  border-top: 0;
  background: #F6F6F6;
  color: #5E5E5E;
  font-family: var(--font-mono);
  font-size: 2.7cqw;
  animation: none;
}
.num {
  text-align: right;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.n { color: #6B6B6B; font-family: var(--font-mono); font-size: 2.9cqw; }
.dot {
  position: relative;
  width: 2.4cqw;
  height: 2.4cqw;
  border-radius: 50%;
  background: #D4D4D4;
}
.ok {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #00A372;
  animation: v-ok var(--T) linear infinite;
  animation-delay: calc(var(--i) * 140ms);
}
.dot.late { background: #DC2626; }
.dot.late .ok { animation-name: v-ok-late; }
.cell { position: relative; justify-self: end; padding: 0.6cqw 1.2cqw; margin-right: -1.2cqw; }
.cell::before,
.cell::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 0.8cqw;
  opacity: 0;
}
.cell::before {
  background: #FDE7E7;
  box-shadow: inset 0 -0.5cqw 0 #DC2626;
  animation: v-early var(--T) linear infinite;
  animation-delay: calc(var(--i) * 140ms);
}
.cell::after {
  box-shadow: 0 0 0 0.5cqw #0A0A0A;
  animation: v-edit var(--T) linear infinite;
  animation-delay: calc(var(--i) * 140ms);
}
.bad-v, .good-v { position: relative; z-index: 1; }
.bad-v { position: absolute; right: 1.2cqw; opacity: 0; color: #B91C1C; animation: v-early var(--T) linear infinite; animation-delay: calc(var(--i) * 140ms); }
.good-v { animation: v-late var(--T) linear infinite; animation-delay: calc(var(--i) * 140ms); }

@keyframes v-row-in {
  0% { opacity: 0; transform: translateY(60%); }
  7%, 93% { opacity: 1; transform: none; }
  100% { opacity: 0; transform: none; }
}
@keyframes v-ok {
  0%, 18% { opacity: 0; transform: scale(0.3); }
  23%, 100% { opacity: 1; transform: none; }
}
@keyframes v-ok-late {
  0%, 50% { opacity: 0; transform: scale(0.3); }
  55%, 100% { opacity: 1; transform: none; }
}
@keyframes v-early {
  0%, 48% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
@keyframes v-late {
  0%, 48% { opacity: 0; }
  50%, 100% { opacity: 1; }
}
@keyframes v-edit {
  0%, 30% { opacity: 0; }
  32%, 54% { opacity: 1; }
  58%, 100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .v-sheet *, .v-sheet *::before, .v-sheet *::after { animation: none !important; }
}
</style>
