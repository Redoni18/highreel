// Canonical links for public pages (SPEC M2.11). They name the real site
// (runtimeConfig.public.siteOrigin, https://highreel.app), not the request:
// the landing is built once at build time, and local or preview hosts
// shouldn't compete with it in search.

/** An absolute URL on the public site. */
export function siteHref(path = '/'): string {
  return new URL(path, useRuntimeConfig().public.siteOrigin).href
}

/** Sets the page's canonical link and og:url; returns the URL. */
export function useCanonical(path: string): string {
  const href = siteHref(path)
  useHead({ link: [{ rel: 'canonical', href }] })
  useSeoMeta({ ogUrl: href })
  return href
}
