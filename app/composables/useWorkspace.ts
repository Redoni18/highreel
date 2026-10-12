// State and actions for a recap (/app/c/:id and its Sheet, Design and Share
// tabs, SPEC M2.6): the campaign, its rows, the selected row, filters, the
// unsaved design, and every server call they make. Created once by
// pages/app/c/[id].vue and shared with the tabs through provide/inject, so
// rows load once and unsaved edits survive switching tabs.

import { useEventListener } from '@vueuse/core'
import { toast } from 'vue-sonner'
import type { InjectionKey } from 'vue'
import type { Business, Campaign, CampaignPhoto, CampaignSettings, CampaignSummary, PatchRecipientResponse, PublishResponse, Recipient, RecapPayload, Workspace, WorkspaceIndex } from '#shared/types/recap'
import type { CustomColumn, ParsedRow, RawRow } from '#shared/templates/types'
import { getTemplate, templateFor } from '#shared/templates'
import { changeColumn as changeOwnColumn, slideEntries, type OwnSettings } from '#shared/templates/own'
import { computeTopPercents, hasErrors, validateRow } from '#shared/utils/validate'
import { isOldExcel, isSheetFile, parseCsv, parseSheetFile, type ParsedSheet } from '~/utils/csv'
import { applyMapping, autoMap, needsMapping, preselect, settingsForSheet, sheetExtras, type ColumnMapping, type SheetExtra } from '#shared/utils/mapping'
import { shrinkImage } from '~/utils/media'
import { MAX_PHOTOS, toRecapRecipient } from '#shared/utils/recap'
import { EXAMPLES } from '~/data/examples'

export type RowStatus = 'saving' | 'error' | 'ready' | 'published'
export type RowFilter = 'all' | 'errors' | 'ready' | 'published'
export interface CellRef { rowId: string, colId: string }

export interface CampaignPatch {
  name?: string
  settings?: Partial<Omit<CampaignSettings, 'photos_consent_at' | 'email_consent_at'>> & { photos_consent?: boolean, email_consent?: boolean }
  business?: Partial<Pick<Business, 'name' | 'accent_color' | 'website_url' | 'logo_path'>>
}

function createWorkspace() {
  const route = useRoute()
  const router = useRouter()
  const supabase = useSupabaseClient()
  const { api, fail, endSession, signOut } = useApi()

  const business = ref<Business | null>(null)
  const campaigns = ref<CampaignSummary[]>([])
  const anonymous = ref(false)
  const campaign = ref<Campaign | null>(null)
  const rows = shallowRef<Recipient[]>([])
  const saving = ref(new Set<string>())
  const loading = ref(true)
  const loadError = ref<string | null>(null)
  const busy = ref<null | 'import' | 'publish'>(null)

  const selectedId = ref<string | null>(null)
  const activeCell = ref<CellRef | null>(null)
  const filter = ref<RowFilter>('all')
  const search = ref('')

  /** A parsed sheet waiting for "Replace N rows?" confirmation, with the own columns it brings (M2.7). */
  const pendingImport = shallowRef<(ParsedSheet & { own?: Required<OwnSettings> }) | null>(null)
  /** A sheet whose headers need matching to the template, or that brings new columns (SPEC M2f, M2.7). */
  const pendingMapping = shallowRef<{ sheet: ParsedSheet, mapping: ColumnMapping, extras: SheetExtra[] } | null>(null)
  /** Set by the page: opens the hidden file input. */
  let openFilePicker: () => void = () => {}

  const previewOpen = ref(true)
  const previewWidth = ref(380)
  /** Unsaved Design edits (this recap's settings), shown live in every preview until saved or discarded. */
  const draft = ref<CampaignSettings | null>(null)
  /** The settings the Design tab edits and saves (photos save on their own). */
  const designFields = (s: CampaignSettings) => JSON.stringify({
    items_label: s.items_label,
    founder_note: s.founder_note,
    cta_label: s.cta_label,
    cta_url: s.cta_url,
    copy: Object.fromEntries(Object.entries(s.copy).filter(([, v]) => v?.trim()).sort()),
    theme: s.theme,
    guess_first: s.guess_first,
    columns: s.columns ?? [],
    // The slide list as it plays, so a list that equals the template's isn't a change.
    slides: slideEntries(baseTemplate.value, s).map(e => e.setting),
  })
  const designDirty = computed(() => !!draft.value && !!campaign.value && designFields(draft.value) !== designFields(campaign.value.settings))

  /** The template alone, and with this recap's own columns and slides (SPEC M2.7): saved, and as the previews play it. */
  const baseTemplate = computed(() => getTemplate(campaign.value?.template_key ?? 'app'))
  const template = computed(() => templateFor(campaign.value?.template_key ?? 'app', campaign.value?.settings))
  const previewTemplate = computed(() => templateFor(campaign.value?.template_key ?? 'app', draft.value ?? campaign.value?.settings))
  const isPublished = computed(() => campaign.value?.status === 'published')
  /** One recap about the business itself, filled in with a form (SPEC M2.5 P4). */
  const isBusiness = computed(() => campaign.value?.kind === 'business')
  /** The business form's unsaved values and note, shown live in the preview. */
  const formDraft = ref<{ raw: RawRow, note: string } | null>(null)
  /** Set by the business form: saves it if it has changes; false when it couldn't. */
  let formSaver: () => Promise<boolean> = async () => true

  function statusOf(row: Recipient): RowStatus {
    if (saving.value.has(row.id))
      return 'saving'
    if (hasErrors(row.errors))
      return 'error'
    return row.token ? 'published' : 'ready'
  }

  const counts = computed(() => {
    let errors = 0
    let published = 0
    let viewed = 0
    for (const row of rows.value) {
      if (hasErrors(row.errors))
        errors++
      else if (row.token)
        published++
      if (row.view_count > 0)
        viewed++
    }
    return { total: rows.value.length, errors, published, ready: rows.value.length - errors - published, viewed }
  })

  /** Live "top X%" for the preview (publish stores the same computation). */
  const topPercents = computed(() => {
    const list = rows.value
    const by = template.value.rank?.by
    const values = by
      ? computeTopPercents(list.map(r => ({ valid: !hasErrors(r.errors), value: r.data[by] })))
      : list.map(() => null)
    const map = new Map<string, number | null>()
    list.forEach((r, i) => map.set(r.id, values[i] ?? null))
    return map
  })

  /** Live "top X%" for the preview's added rank slides (M2.7), by the column they rank by. */
  const liveRanks = computed(() => {
    const list = rows.value
    const out = new Map<string, Map<string, number | null>>()
    for (const by of new Set(previewTemplate.value.slides.flatMap(s => (s.rankBy ? [s.rankBy] : [])))) {
      const values = computeTopPercents(list.map(r => ({ valid: !hasErrors(r.errors), value: r.data[by] })))
      out.set(by, new Map(list.map((r, i) => [r.id, values[i] ?? null])))
    }
    return out
  })
  const ranksFor = (rowId: string) => Object.fromEntries([...liveRanks.value].map(([by, m]) => [by, m.get(rowId) ?? null]))

  const searchColumns = computed(() => template.value.columns.filter(c => c.type === 'text' || c.type === 'email' || c.type === 'phone').map(c => c.key))

  const visibleRows = computed(() => {
    const q = search.value.trim().toLowerCase()
    const f = filter.value
    if (!q && f === 'all')
      return rows.value
    const cols = searchColumns.value
    return rows.value.filter((row) => {
      if (f !== 'all') {
        const s = hasErrors(row.errors) ? 'errors' : row.token ? 'published' : 'ready'
        if (s !== f)
          return false
      }
      return !q || cols.some(c => (row.raw[c] ?? '').toLowerCase().includes(q))
    })
  })

  const selectedRow = computed(() => rows.value.find(r => r.id === selectedId.value) ?? null)

  // The preview follows the filter: if the selected row is hidden, show the first visible one.
  watch(visibleRows, (list) => {
    if (list.length && !list.some(r => r.id === selectedId.value))
      selectedId.value = list[0]!.id
  })

  function replaceRows(updated: Recipient[]) {
    if (!updated.length)
      return
    const byId = new Map(updated.map(r => [r.id, r]))
    rows.value = rows.value.map(r => byId.get(r.id) ?? r)
  }

  function resetView() {
    selectedId.value = rows.value[0]?.id ?? null
    activeCell.value = null
    filter.value = 'all'
    search.value = ''
    pendingImport.value = null
    formDraft.value = null
    draft.value = null
  }

  async function refreshIndex(): Promise<WorkspaceIndex> {
    const index = await api<WorkspaceIndex>('/api/workspace')
    business.value = index.business
    campaigns.value = index.campaigns
    anonymous.value = index.anonymous
    return index
  }

  /** Load the user's business and the campaign in the URL (/app/c/:id). */
  async function load() {
    loading.value = true
    loadError.value = null
    try {
      await Promise.all([refreshIndex(), openCampaign(String(route.params.id ?? ''))])
    }
    catch (e) {
      if (isUnauthorized(e))
        return endSession()
      loadError.value = errorMessage(e)
    }
    finally {
      loading.value = false
    }
  }

  async function openCampaign(id: string) {
    const [ws, list] = await Promise.all([
      api<Workspace>(`/api/campaigns/${id}`),
      api<Recipient[]>(`/api/campaigns/${id}/recipients`),
    ])
    business.value = ws.business
    campaign.value = ws.campaign
    rows.value = list
    resetView()
    // Stay on the same tab (Sheet, Design or Share) when switching recaps.
    if (route.params.id !== id)
      await router.replace(`/app/c/${id}${route.path.replace(/^\/app\/c\/[^/]+/, '')}`)
  }

  async function switchCampaign(id: string) {
    if (id === campaign.value?.id)
      return
    try {
      await openCampaign(id)
    }
    catch (e) {
      fail('Couldn\'t open that campaign', e)
    }
  }

  async function createCampaign(input: { name: string, year: number, template_key: string, starter?: string }): Promise<boolean> {
    try {
      const created = await api<Campaign>('/api/campaigns', { method: 'POST', body: input })
      await refreshIndex()
      await openCampaign(created.id)
      return true
    }
    catch (e) {
      fail('Couldn\'t create the campaign', e)
      return false
    }
  }

  async function deleteCampaign() {
    const current = campaign.value
    if (!current)
      return
    try {
      await api(`/api/campaigns/${current.id}`, { method: 'DELETE' })
      toast(`Deleted “${current.name}”`)
      await navigateTo('/app')
    }
    catch (e) {
      fail('Couldn\'t delete the campaign', e)
    }
  }

  async function clearRows() {
    if (!campaign.value)
      return
    try {
      await api(`/api/campaigns/${campaign.value.id}/recipients`, { method: 'DELETE' })
      rows.value = []
      resetView()
      await refreshIndex()
    }
    catch (e) {
      fail('Couldn\'t clear the rows', e)
    }
  }

  // Views, saves and shares arrive while the workspace is open in another tab:
  // refresh just those counters when the page is looked at again.
  let lastEngagement = 0
  async function refreshEngagement(force = false) {
    const id = campaign.value?.id
    if (!id || !isPublished.value || (!force && Date.now() - lastEngagement < 15_000))
      return
    lastEngagement = Date.now()
    try {
      const fresh = await api<Recipient[]>(`/api/campaigns/${id}/recipients`)
      if (campaign.value?.id !== id)
        return
      const byId = new Map(fresh.map(r => [r.id, r]))
      rows.value = rows.value.map((r) => {
        const f = byId.get(r.id)
        return f
          ? { ...r, view_count: f.view_count, first_viewed_at: f.first_viewed_at, saved_at: f.saved_at, shared_at: f.shared_at, cta_clicked_at: f.cta_clicked_at, emailed_at: f.emailed_at, email_error: f.email_error }
          : r
      })
    }
    catch {}
  }
  if (import.meta.client) {
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible')
        refreshEngagement()
    })
  }

  async function importRows(data: Record<string, string>[], source: string, own?: Required<OwnSettings>) {
    if (!campaign.value)
      return
    busy.value = 'import'
    try {
      const res = await api<{ recipients: Recipient[], settings: CampaignSettings }>(`/api/campaigns/${campaign.value.id}/import`, {
        method: 'POST',
        body: { rows: data, ...own },
      })
      // The sheet's own columns (M2.7) are saved with it; resetView() starts the design draft over from them.
      campaign.value = { ...campaign.value, settings: { ...res.settings, photos: campaign.value.settings.photos } }
      rows.value = res.recipients
      resetView()
      refreshIndex().catch(() => {})
      const n = counts.value
      toast.success(`${n.total.toLocaleString('en-US')} rows imported${n.errors ? ` · ${n.errors} need fixing` : ''}`, {
        description: source,
      })
    }
    catch (e) {
      fail('Import failed', e)
    }
    finally {
      busy.value = null
    }
  }

  async function acceptSheet(sheet: ParsedSheet) {
    if (isPublished.value) {
      toast.error('This campaign is published', { description: 'Edit rows in the grid, or start a new campaign from the campaign menu.' })
      return
    }
    if (!sheet.rows.length) {
      toast.error('The sheet has no rows', { description: sheet.name })
      return
    }
    // Template fields by name and synonyms; every other column may be the recap's own (M2.7).
    const base = baseTemplate.value
    const mapping = autoMap(sheet.headers, base)
    const extras = preselect(sheetExtras(sheet.headers, sheet.rows, base, campaign.value?.settings.columns ?? [], mapping))
    const used = new Set(Object.values(mapping))
    if (needsMapping(sheet.headers, base, mapping) || extras.some(e => !e.existing && !used.has(e.header))) {
      pendingMapping.value = { sheet, mapping, extras }
      return
    }
    await acceptMappedSheet(sheet, mapping, extras, true)
  }

  /** After the mapping dialog: the fields it matched and the own columns it ticked. */
  async function confirmMapping(mapping: ColumnMapping, extras: SheetExtra[]) {
    const pending = pendingMapping.value
    pendingMapping.value = null
    if (pending)
      await acceptMappedSheet(pending.sheet, mapping, extras, false)
  }

  /** Rename the rows to the template's fields and the recap's own columns, and go on. */
  async function acceptMappedSheet(sheet: ParsedSheet, mapping: ColumnMapping, extras: SheetExtra[], quiet: boolean) {
    const used = new Set(Object.values(mapping).filter(Boolean))
    const own = extras.filter(e => !used.has(e.header))
    const kept = own.filter(e => e.keep)
    const full: ColumnMapping = { ...mapping, ...Object.fromEntries(kept.map(e => [e.key, e.header])) }
    const settings = campaign.value!.settings
    const next = settingsForSheet(baseTemplate.value, settings, own)
    const changed = JSON.stringify(next) !== JSON.stringify({ columns: settings.columns ?? [], slides: settings.slides ?? null })
    const ignored = sheet.headers.filter(h => h && !used.has(h) && !kept.some(e => e.header === h))
    if (quiet && ignored.length) {
      toast(`Ignored ${ignored.length} empty ${ignored.length === 1 ? 'column' : 'columns'}`, { description: ignored.join(', ') })
    }
    const mapped = { ...sheet, headers: Object.keys(full).filter(k => full[k]), rows: applyMapping(sheet.rows, full), missing: [], unknown: [], own: changed ? next : undefined }
    if (rows.value.length)
      pendingImport.value = mapped
    else
      await importRows(mapped.rows, mapped.name, mapped.own)
  }

  async function handleFile(file: File) {
    if (isBusiness.value) {
      toast.error('This highlight reel is filled in with its form', { description: 'Sheets go into a highlight reel for each customer.' })
      return
    }
    if (isOldExcel(file)) {
      toast.error('Old Excel format (.xls)', { description: 'Save the sheet as .xlsx or .csv and upload it again.' })
      return
    }
    if (!isSheetFile(file)) {
      toast.error('Upload a .csv or .xlsx file', { description: file.name })
      return
    }
    try {
      await acceptSheet(await parseSheetFile(file, template.value))
    }
    catch (e) {
      fail('Couldn\'t read that file', e)
    }
  }

  async function loadSample() {
    try {
      const file = template.value.files.sample
      const text = await $fetch<string>(file, { responseType: 'text' })
      await acceptSheet(await parseCsv(text, file.split('/').pop()!, template.value))
    }
    catch (e) {
      fail('Couldn\'t load the sample', e)
    }
  }

  async function confirmImport() {
    const sheet = pendingImport.value
    pendingImport.value = null
    if (sheet)
      await importRows(sheet.rows, sheet.name, sheet.own)
  }

  function setFilePicker(fn: () => void) {
    openFilePicker = fn
  }

  function pickFile() {
    if (isBusiness.value)
      return
    if (isPublished.value) {
      toast.error('This campaign is published', { description: 'Edit rows in the grid, or start a new campaign from the campaign menu.' })
      return
    }
    openFilePicker()
  }

  async function editCell(row: Recipient, column: string, value: string) {
    const next = value.trim()
    if ((row.raw[column] ?? '') === next)
      return
    const previous = row
    replaceRows([{ ...row, raw: { ...row.raw, [column]: next } }])
    saving.value = new Set(saving.value).add(row.id)
    try {
      const res = await api<PatchRecipientResponse>(`/api/recipients/${row.id}`, {
        method: 'PATCH',
        body: { column, value: next },
      })
      replaceRows([res.row, ...res.others])
    }
    catch (e) {
      replaceRows([previous])
      fail(`Couldn't save row ${row.row_index + 1}`, e)
    }
    finally {
      const s = new Set(saving.value)
      s.delete(row.id)
      saving.value = s
    }
  }

  async function publish() {
    if (!campaign.value)
      return
    busy.value = 'publish'
    try {
      const res = await api<PublishResponse>(`/api/campaigns/${campaign.value.id}/publish`, { method: 'POST' })
      rows.value = res.recipients
      campaign.value = { ...campaign.value, status: 'published', published_at: campaign.value.published_at ?? new Date().toISOString() }
      if (isBusiness.value) {
        const token = res.recipients[0]?.token
        toast.success('Your highlight reel is live', {
          description: 'Copy its link, or save the images for your posts.',
          action: token ? { label: 'Copy link', onClick: () => navigator.clipboard.writeText(recapUrl(token)) } : undefined,
          duration: 10_000,
        })
        return
      }
      toast.success(`${res.published.toLocaleString('en-US')} highlight reels published`, {
        description: res.skipped ? `${res.skipped} rows skipped (need fixing)` : 'Every row has a link',
        // Sending happens on Share (M2.8); there already, the toast just says it's done.
        action: route.path.endsWith('/share') ? undefined : { label: 'Send them', onClick: () => router.push(`/app/c/${campaign.value!.id}/share`) },
        duration: 10_000,
      })
    }
    catch (e) {
      fail('Publish failed', e)
    }
    finally {
      busy.value = null
    }
  }

  // --- The business's own recap (SPEC M2.5 P4) -------------------------------

  /** Save the form: its one row, and the thank-you note when it changed. */
  async function saveBusiness(raw: RawRow, note: string): Promise<boolean> {
    if (!campaign.value)
      return false
    try {
      const row = await api<Recipient>(`/api/campaigns/${campaign.value.id}/business`, { method: 'PUT', body: { raw } })
      rows.value = [row]
      selectedId.value = row.id
      if (note.trim() !== campaign.value.settings.founder_note)
        return await updateCampaign({ settings: { founder_note: note } })
      return true
    }
    catch (e) {
      fail('Couldn\'t save', e)
      return false
    }
  }

  function setFormSaver(fn: () => Promise<boolean>) {
    formSaver = fn
  }

  /** Publish button for a business recap: save pending changes, then publish. */
  async function publishBusiness() {
    if (await formSaver())
      await publish()
  }

  /** The business form's values (unsaved ones first), validated like a sheet row. */
  const businessRow = computed(() => validateRow(formDraft.value?.raw ?? rows.value[0]?.raw ?? {}, template.value))

  /**
   * The landing's example person for this sheet template, for previews before
   * any rows exist; the recap's own columns (M2.7) get made-up values.
   */
  const exampleRecipient = computed(() => {
    const t = previewTemplate.value
    const found = EXAMPLES.find(e => e.payload.template_key === t.key)?.payload.recipient
    const own = t.columns.filter(c => c.label !== undefined)
    if (!own.length && found)
      return found
    const data: ParsedRow = { first_name: found?.first_name ?? 'Ana', ...found?.values }
    own.forEach((c, i) => {
      data[c.key] = c.type === 'int' ? [12, 48, 7, 230, 31][i % 5]! : c.type === 'decimal' ? 24.5 : c.type === 'date' ? `${campaign.value?.year ?? 2026}-0${(i % 9) + 1}-14` : 'Example'
    })
    const ranks = Object.fromEntries(t.slides.flatMap(s => (s.rankBy ? [[s.rankBy, 8]] : [])))
    return toRecapRecipient(t, data, null, { ranks, copy: (draft.value ?? campaign.value?.settings)?.copy })
  })

  /**
   * What the previews play: the selected row (or the business form; or, with
   * no rows yet, the example person) with the Design tab's unsaved edits,
   * including its slide list. Unpublished data is fine here, never on /r.
   */
  const previewPayload = computed<RecapPayload | null>(() => {
    const live = business.value
    const c = campaign.value
    if (!live || !c)
      return null
    // Unsaved Design edits; photos are always live (they save on their own).
    const base = draft.value ?? c.settings
    const t = previewTemplate.value
    let recipient
    if (isBusiness.value) {
      recipient = toRecapRecipient(t, businessRow.value.data, undefined, { copy: base.copy })
    }
    else {
      const r = selectedRow.value ?? visibleRows.value[0]
      if (r)
        recipient = toRecapRecipient(t, r.data, topPercents.value.get(r.id) ?? null, { ranks: ranksFor(r.id), copy: base.copy })
      else if (exampleRecipient.value)
        recipient = exampleRecipient.value
      else
        return null
    }
    return {
      template_key: c.template_key,
      year: c.year,
      business: live,
      settings: {
        ...base,
        founder_note: isBusiness.value && formDraft.value ? formDraft.value.note : base.founder_note,
        photos: c.settings.photos,
        photo_in_share_image: c.settings.photo_in_share_image,
      },
      recipient,
    }
  })
  /** True while the previews play the example person (no rows yet). */
  const previewIsExample = computed(() => !isBusiness.value && !rows.value.length && !!exampleRecipient.value)

  async function updateCampaign(patch: CampaignPatch): Promise<boolean> {
    if (!campaign.value)
      return false
    try {
      const ws = await api<Workspace>(`/api/campaigns/${campaign.value.id}`, { method: 'PATCH', body: patch })
      business.value = ws.business
      campaign.value = ws.campaign
      return true
    }
    catch (e) {
      fail('Couldn\'t save', e)
      return false
    }
  }

  /** Saves the Design draft (Design's Save, and "Save and leave" when leaving with edits). */
  async function saveDesign(): Promise<boolean> {
    const s = draft.value
    if (!s)
      return true
    const ok = await updateCampaign({
      settings: {
        items_label: s.items_label,
        // A business recap writes its note in Content.
        ...(isBusiness.value ? {} : { founder_note: s.founder_note }),
        cta_label: s.cta_label,
        cta_url: s.cta_url,
        copy: s.copy,
        theme: s.theme,
        guess_first: s.guess_first,
        columns: s.columns ?? [],
        slides: s.slides ?? null,
      },
    })
    // Cleared: Design (if it's open) starts a fresh draft from what was saved.
    if (ok)
      draft.value = null
    return ok
  }

  // --- Group photos (SPEC M2c; the logo is on Your brand since M2.6) ----------
  const mediaBusy = ref(false)

  async function upload(path: string, blob: Blob) {
    const { error } = await supabase.storage.from('media').upload(path, blob, {
      contentType: blob.type,
      cacheControl: '31536000',
      upsert: false,
    })
    if (error)
      throw error
  }

  const photos = computed(() => campaign.value?.settings.photos ?? [])

  async function savePhotos(next: CampaignPhoto[], extra: CampaignPatch['settings'] = {}) {
    return updateCampaign({ settings: { photos: next.map(({ url: _url, ...p }) => p), ...extra } })
  }

  async function addPhotos(files: File[], consent: boolean) {
    if (!business.value || !campaign.value)
      return
    const room = MAX_PHOTOS - photos.value.length
    if (files.length > room)
      toast(`Only ${MAX_PHOTOS} photos per campaign`, { description: room ? `Adding the first ${room}.` : 'Remove one to add another.' })
    const chosen = files.slice(0, Math.max(0, room))
    if (!chosen.length)
      return
    mediaBusy.value = true
    const added: CampaignPhoto[] = []
    try {
      for (const file of chosen) {
        const img = await shrinkImage(file, 2000)
        const id = crypto.randomUUID()
        const path = `${business.value.id}/${campaign.value.id}/${id}.${img.ext}`
        await upload(path, img.blob)
        added.push({ id, path, caption: '', width: img.width, height: img.height })
      }
    }
    catch (e) {
      fail('Couldn\'t upload a photo', e)
    }
    if (added.length && !await savePhotos([...photos.value, ...added], consent ? { photos_consent: true } : {}))
      await supabase.storage.from('media').remove(added.map(p => p.path))
    mediaBusy.value = false
  }

  async function removePhoto(id: string) {
    const photo = photos.value.find(p => p.id === id)
    if (photo && await savePhotos(photos.value.filter(p => p.id !== id)))
      await supabase.storage.from('media').remove([photo.path])
  }

  async function movePhoto(id: string, delta: -1 | 1) {
    const list = [...photos.value]
    const at = list.findIndex(p => p.id === id)
    const to = at + delta
    if (at < 0 || to < 0 || to >= list.length)
      return
    ;[list[at], list[to]] = [list[to]!, list[at]!]
    await savePhotos(list)
  }

  async function setPhotoCaption(id: string, caption: string) {
    const list = photos.value.map(p => (p.id === id ? { ...p, caption: caption.trim() } : p))
    await savePhotos(list)
  }

  function exportLinks() {
    if (!campaign.value)
      return
    const a = document.createElement('a')
    a.href = `/api/campaigns/${campaign.value.id}/export.csv`
    a.download = ''
    a.click()
  }

  function recapUrl(token: string) {
    return `${window.location.origin}/r/${token}`
  }

  /**
   * Change one of the recap's own columns from the Sheet (M2.7): its type, or
   * remove it. The server checks every row again; an open Design draft
   * follows the change, so saving it can't bring the old column back.
   */
  async function changeColumn(key: string, change: { type: CustomColumn['type'] } | { remove: true }): Promise<boolean> {
    if (!campaign.value)
      return false
    try {
      const res = await api<{ settings: CampaignSettings, recipients: Recipient[] }>(`/api/campaigns/${campaign.value.id}/columns`, {
        method: 'PATCH',
        body: { key, ...change },
      })
      campaign.value = { ...campaign.value, settings: { ...res.settings, photos: campaign.value.settings.photos } }
      if (res.recipients.length)
        rows.value = res.recipients
      if (draft.value)
        Object.assign(draft.value, changeOwnColumn(draft.value, key, change))
      if ('remove' in change && activeCell.value?.colId === key)
        activeCell.value = null
      return true
    }
    catch (e) {
      fail('Couldn\'t change the column', e)
      return false
    }
  }

  /** The sheet to fill in: the template's file, or with the recap's own columns (M2.7) a header row of all its columns. */
  function downloadSheet() {
    const t = template.value
    const a = document.createElement('a')
    if (campaign.value?.settings.columns?.length) {
      const csv = `${t.columns.map(c => c.key).join(',')}\n`
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      a.download = `${campaign.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'highlight-reels'}-sheet.csv`
    }
    else {
      a.href = t.files.template
      a.download = t.files.template.split('/').pop()!
    }
    a.click()
  }

  return {
    business,
    campaigns,
    anonymous,
    campaign,
    rows,
    loading,
    loadError,
    busy,
    selectedId,
    selectedRow,
    activeCell,
    pendingImport,
    pendingMapping,
    confirmMapping,
    filter,
    search,
    previewOpen,
    previewWidth,
    draft,
    designDirty,
    saveDesign,
    template,
    baseTemplate,
    previewTemplate,
    downloadSheet,
    changeColumn,
    isPublished,
    isBusiness,
    formDraft,
    businessRow,
    saveBusiness,
    setFormSaver,
    publishBusiness,
    previewPayload,
    previewIsExample,
    counts,
    topPercents,
    visibleRows,
    statusOf,
    load,
    importRows,
    handleFile,
    loadSample,
    confirmImport,
    setFilePicker,
    pickFile,
    editCell,
    publish,
    updateCampaign,
    exportLinks,
    recapUrl,
    mediaBusy,
    photos,
    addPhotos,
    removePhoto,
    movePhoto,
    setPhotoCaption,
    refreshIndex,
    switchCampaign,
    createCampaign,
    deleteCampaign,
    clearRows,
    refreshEngagement,
    signOut,
  }
}

export type WorkspaceStore = ReturnType<typeof createWorkspace>
const KEY: InjectionKey<WorkspaceStore> = Symbol('workspace')

export function provideWorkspace(): WorkspaceStore {
  const ws = createWorkspace()
  provide(KEY, ws)
  return ws
}

export function useWorkspace(): WorkspaceStore {
  const ws = inject(KEY)
  if (!ws)
    throw new Error('useWorkspace() outside the workspace page')
  return ws
}
