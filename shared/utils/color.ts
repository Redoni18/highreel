// Colour helpers for recaps. The workspace is monochrome; colour only comes
// from the business's accent (SPEC §5.3). Plain sRGB maths so the DOM slides
// and the canvas share image get identical colours.

type Rgb = [number, number, number]

export function normalizeHex(input: string | null | undefined): string | null {
  if (!input)
    return null
  let s = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s))
    s = [...s].map(c => c + c).join('')
  return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toUpperCase()}` : null
}

function toRgb(hex: string): Rgb {
  const s = (normalizeHex(hex) ?? '#111111').slice(1)
  return [0, 2, 4].map(i => Number.parseInt(s.slice(i, i + 2), 16)) as Rgb
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** `weight` of `a`, the rest of `b`. */
export function mix(a: string, b: string, weight: number): string {
  const [ar, ag, ab] = toRgb(a)
  const [br, bg, bb] = toRgb(b)
  return toHex([ar * weight + br * (1 - weight), ag * weight + bg * (1 - weight), ab * weight + bb * (1 - weight)])
}

/** The same colour turned `degrees` around the hue wheel (the recap page's backdrop, M2.8). */
export function shiftHue(hex: string, degrees: number): string {
  const [r, g, b] = toRgb(hex).map(v => v / 255) as Rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0)
    return toHex([r * 255, g * 255, b * 255])
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (((h * 60 + degrees) % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return toHex([(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255])
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Black or white text on `bg`, whichever contrasts more (WCAG AA picks). */
export function readableOn(bg: string): string {
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#0A0A0A') ? '#FFFFFF' : '#0A0A0A'
}

export interface Tone {
  bg: string
  fg: string
  /** big numbers and the highlighted value */
  hi: string
  /** decorative shapes */
  shape: string
}

export interface RecapPalette {
  accent: Tone
  dark: Tone
  light: Tone
}

export type RecapTheme = 'stories' | 'paper'
const PAPER = '#F4F1EA'
export const INK = '#151515'

/** "Paper" (M2h): light paper, ink text, the accent only for highlights. */
function paperPalette(accent: string): RecapPalette {
  const paper2 = '#EAE5DB'
  // Darken the accent until big numbers read well on paper.
  let hi = accent
  for (let w = 0.9; contrast(hi, PAPER) < 4.5 && w > 0; w -= 0.1)
    hi = mix(accent, INK, w)
  // `shape` is the solid accent: Paper uses thin bars and rules, not soft circles.
  return {
    accent: { bg: PAPER, fg: INK, hi, shape: accent },
    dark: { bg: paper2, fg: INK, hi, shape: accent },
    light: { bg: PAPER, fg: INK, hi, shape: accent },
  }
}

/** Three slide tones derived from one accent colour. */
export function recapPalette(accentInput: string, theme: RecapTheme = 'stories'): RecapPalette {
  const accent = normalizeHex(accentInput) ?? '#111111'
  if (theme === 'paper')
    return paperPalette(accent)
  const onAccent = readableOn(accent)

  const darkBg = mix(accent, '#0A0A0A', 0.24)
  const lightAccent = mix(accent, '#FFFFFF', 0.6)
  const darkHi = contrast(lightAccent, darkBg) >= 4.5 ? lightAccent : '#FFFFFF'

  const lightBg = mix(accent, '#FFFFFF', 0.1)
  const deepAccent = mix(accent, '#0A0A0A', 0.75)
  const lightFg = contrast(deepAccent, lightBg) >= 7 ? mix(accent, '#0A0A0A', 0.4) : '#0A0A0A'
  const lightHi = contrast(accent, lightBg) >= 4.5 ? accent : lightFg

  return {
    accent: { bg: accent, fg: onAccent, hi: onAccent, shape: mix(onAccent, accent, 0.12) },
    dark: { bg: darkBg, fg: '#FFFFFF', hi: darkHi, shape: mix(accent, darkBg, 0.35) },
    light: { bg: lightBg, fg: lightFg, hi: lightHi, shape: mix(accent, lightBg, 0.16) },
  }
}
