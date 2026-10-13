// One admin route's data for a page (SPEC M2.15): loading, an error to show,
// and loading again when the path or query changes (a filter, another user).

export function useAdminFetch<T>(path: () => string, query: () => Record<string, string> = () => ({})) {
  const { api, endSession } = useApi()
  const data = shallowRef<T | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    loading.value = true
    try {
      data.value = await api<T>(path(), { query: query() })
    }
    catch (e) {
      if (isUnauthorized(e))
        return endSession()
      error.value = errorMessage(e)
    }
    finally {
      loading.value = false
    }
  }

  onMounted(load)
  watch(() => `${path()}?${new URLSearchParams(query())}`, load)
  return { data, loading, error, load }
}
