// Soft blobs that morph (the landing's hero, the recap page's backdrop; SPEC
// M2.8): outlines from a polar function sampled around the circle and joined
// with Catmull-Rom curves. Kept apart from the landing's flowers (shapes.ts)
// so /r doesn't carry them.

const TAU = Math.PI * 2
const n1 = (v: number) => Math.round(v * 10) / 10

export function polar(samples: number, radius: (t: number) => number): string {
  const pts = Array.from({ length: samples }, (_, i) => {
    const t = (i / samples) * TAU - Math.PI / 2
    const r = radius(t + Math.PI / 2)
    return [Math.cos(t) * r, Math.sin(t) * r] as const
  })
  const at = (i: number) => pts[(i + samples) % samples]!
  let d = `M${n1(at(0)[0])} ${n1(at(0)[1])}`
  for (let i = 0; i < samples; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    d += `C${n1(p1[0] + (p2[0] - p0[0]) / 6)} ${n1(p1[1] + (p2[1] - p0[1]) / 6)} ${n1(p2[0] - (p3[0] - p1[0]) / 6)} ${n1(p2[1] - (p3[1] - p1[1]) / 6)} ${n1(p2[0])} ${n1(p2[1])}`
  }
  return `${d}Z`
}

/**
 * A soft blob with no particular shape, as `frames` outlines of the same
 * structure (12 points each), so SVG can morph between them (the hero's
 * ambient blobs). Deterministic per seed: server and client draw the same.
 */
export function blobFrames(seed: number, frames = 4): string[] {
  let s = seed * 9301 + 49297
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: frames }, () => {
    const [a, b, c] = [rand() * TAU, rand() * TAU, rand() * TAU]
    return polar(12, t => 100 * (0.8 + 0.1 * Math.sin(2 * t + a) + 0.07 * Math.sin(3 * t + b) + 0.035 * Math.sin(5 * t + c)))
  })
}
