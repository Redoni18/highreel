// Drag to reorder a vertical list by a handle (SPEC M2.8, Design's slide
// rail). The row follows the pointer, the rows it passes slide aside to make
// room, and dropping commits the move. No library: rows are measured once
// when the drag starts, and only transforms change while it runs.
//
//   const sort = useSortable(listEl, () => keys, (from, to) => …)
//   <li :data-sort-key="key" :style="sort.style(key)"> <button @pointerdown="sort.start($event, key)">⠿</button>

import type { Ref } from 'vue'

export function useSortable(list: Ref<HTMLElement | null>, keys: () => string[], commit: (from: number, to: number) => void) {
  const dragging = ref<string | null>(null)
  const offset = ref(0)
  const target = ref(-1)
  /** True for the frame the list re-renders in its new order: no transitions, or rows would slide back. */
  const settling = ref(false)
  let from = -1
  let startY = 0
  let step = 0
  let centers: number[] = []
  let min = 0
  let max = 0

  function start(e: PointerEvent, key: string) {
    if (e.button !== 0 || !list.value)
      return
    const rows = [...list.value.querySelectorAll<HTMLElement>('[data-sort-key]')]
    const rects = rows.map(r => r.getBoundingClientRect())
    from = keys().indexOf(key)
    if (from < 0 || rects.length !== keys().length)
      return
    e.preventDefault()
    const first = rects[0]!
    const second = rects[1]
    // The distance between two rows' tops: their height plus the gap.
    step = second ? second.top - first.top : first.height
    centers = rects.map(r => r.top + r.height / 2)
    min = rects[0]!.top - rects[from]!.top
    max = rects[rects.length - 1]!.top - rects[from]!.top
    startY = e.clientY
    offset.value = 0
    target.value = from
    dragging.value = key
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', cancel)
  }

  function move(e: PointerEvent) {
    offset.value = Math.max(min, Math.min(max, e.clientY - startY))
    const center = centers[from]! + offset.value
    let to = 0
    centers.forEach((c, i) => {
      if (i !== from && c < center)
        to++
    })
    target.value = to
  }

  function stop() {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', cancel)
  }

  function end() {
    stop()
    const to = target.value
    settling.value = true
    if (to !== from && to >= 0)
      commit(from, to)
    dragging.value = null
    offset.value = 0
    target.value = -1
    nextTick(() => requestAnimationFrame(() => (settling.value = false)))
  }

  function cancel() {
    stop()
    dragging.value = null
    offset.value = 0
    target.value = -1
  }

  /** Where a row sits while something is being dragged. */
  function style(key: string): Record<string, string> {
    if (!dragging.value)
      return settling.value ? { transition: 'none' } : {}
    const i = keys().indexOf(key)
    if (key === dragging.value)
      return { transform: `translateY(${offset.value}px)`, transition: 'none', zIndex: '2' }
    const to = target.value
    let dy = 0
    if (from < to && i > from && i <= to)
      dy = -step
    else if (from > to && i >= to && i < from)
      dy = step
    return { transform: dy ? `translateY(${dy}px)` : '' }
  }

  onBeforeUnmount(stop)

  return { dragging, start, style }
}
