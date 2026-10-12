// The landing's HTML rewrite (see index.ts), apart so it can be tested.

/** Runs after the HTML is parsed: wait for the largest paint, then a frame, then load the app. */
const loader = (src: string) => `<script type="module">let go=()=>{go=()=>{};import(${JSON.stringify(src)})};const soon=()=>requestAnimationFrame(()=>setTimeout(go));try{new PerformanceObserver(soon).observe({type:'largest-contentful-paint',buffered:true})}catch{}addEventListener('load',()=>setTimeout(go,document.visibilityState==='visible'&&PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')?2000:0))</script>`

/** Latin text faces declared in the page's own styles (Outfit, the notes' Caveat): fetched with the HTML, not after the CSS. */
export function fontPreloads(html: string): string[] {
  const urls = new Set<string>()
  for (const [face] of html.matchAll(/@font-face\s*{[^}]*}/g)) {
    const url = face.match(/url\(["']?([^"')]+\.woff2)["']?\)/)?.[1]
    const range = face.match(/unicode-range:([^;}]+)/)?.[1]
    if (url && (!range || /U\+\?\?|U\+0+-0*FF\b/i.test(range)))
      urls.add(url)
  }
  return [...urls]
}

export function firstPaint(html: string, readAsset: (path: string) => string): string {
  let entry = false
  const preloads = fontPreloads(html).map(href => `<link rel="preload" as="font" type="font/woff2" href="${href}" crossorigin>`).join('')
  const out = html
    .replace(/(<meta charset="utf-8">)/, `$1${preloads}`)
    .replace(/<link rel="stylesheet" href="([^"]+\.css)"[^>]*>/g, (_, href: string) => {
      // url(../_fonts/x.woff2) is relative to the stylesheet; make it absolute.
      const css = readAsset(href).replace(/url\((["']?)([^"')]+)\1\)/g, (m, q: string, u: string) =>
        /^(?:data:|\/|[a-z]+:|#)/i.test(u) ? m : `url(${q}${new URL(u, `http://x${href}`).pathname}${q})`)
      return `<style>${css}</style>`
    })
    .replace(/<link rel="modulepreload"[^>]*>/g, '')
    .replace(/<link rel="preload" as="fetch"[^>]*>/g, '')
    .replace(/<script type="module" src="([^"]+)"[^>]*><\/script>/, (_, src: string) => {
      entry = true
      return loader(src)
    })
  if (!entry)
    throw new Error('landing-first-paint: the entry script tag changed shape; update the module')
  return out
}
