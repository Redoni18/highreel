// The landing and the terms/privacy pages scroll smoothly (main.css), and
// Nuxt's scroll on a page change (to the top, or back to the saved spot on
// Back/Forward) names no behaviour, so the page's CSS would make it glide past
// everything. Name it: page changes jump. Jumps to a #section keep their own
// behaviour (smooth there, through the CSS).
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  // Nuxt sets the router's scroll function itself once the first page is in,
  // so wrap it after that.
  nuxtApp.hook('app:mounted', () => {
    const scroll = router.options.scrollBehavior
    if (!scroll)
      return
    router.options.scrollBehavior = async (to, from, saved) => {
      const at = await scroll(to, from, saved)
      if (at && typeof at === 'object' && !('el' in at) && !('behavior' in at && at.behavior))
        return { ...at, behavior: 'instant' }
      return at
    }
  })
})
