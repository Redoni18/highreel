// robots.txt (SPEC M2.11), prerendered. The workspace and the API stay out of
// search; recaps (/r) and unsubscribe pages aren't blocked here but answer
// with `X-Robots-Tag: noindex` (a blocked page can't say "noindex", and link
// previews need /r and its image, /api/r/:token/og.png).
export default defineEventHandler((event) => {
  const origin = useRuntimeConfig(event).public.siteOrigin.replace(/\/$/, '')
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Disallow: /app',
    'Disallow: /api/',
    'Allow: /api/r/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
})
