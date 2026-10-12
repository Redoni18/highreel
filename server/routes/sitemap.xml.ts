// sitemap.xml (SPEC M2.11), prerendered: the landing, the full-screen
// example recaps, the terms and privacy pages (M2.12). Everything else is
// private (recaps) or a tool (/app, /login).
import { EXAMPLES } from '~/data/examples'

export default defineEventHandler((event) => {
  const origin = useRuntimeConfig(event).public.siteOrigin.replace(/\/$/, '')
  const day = new Date().toISOString().slice(0, 10)
  const urls = ['/', ...EXAMPLES.map(e => `/example/${e.key}`), '/terms', '/privacy']
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${origin}${u}</loc><lastmod>${day}</lastmod></url>`).join('\n')}
</urlset>
`
})
