// Replace all recipients of a draft campaign with parsed sheet rows. The
// browser parses the file; the server validates again (SPEC §4.2). The sheet
// may bring the recap's own columns and slide list (M2.7), saved first so the
// rows are validated against them.

import type { CampaignSettings, Recipient } from '#shared/types/recap'
import { getTemplate, idColumnOf, templateFor } from '#shared/templates'
import { cleanColumns, cleanSlides, ownKeyOk } from '#shared/templates/own'
import { storableSettings } from '#shared/utils/recap'
import { checkHeaders, normalizeRaw, validateSheet } from '#shared/utils/validate'

const MAX_ROWS = 50_000

export default defineEventHandler(async (event): Promise<{ recipients: Recipient[], settings: CampaignSettings }> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = await readBody<{ rows?: unknown, columns?: unknown, slides?: unknown }>(event)
  const rows = body?.rows
  if (!Array.isArray(rows) || rows.some(r => !r || typeof r !== 'object'))
    throw createError({ statusCode: 400, message: 'Expected { rows: [...] }' })
  if (rows.length === 0)
    throw createError({ statusCode: 400, message: 'The sheet has no rows' })
  if (rows.length > MAX_ROWS)
    throw createError({ statusCode: 413, message: `Up to ${MAX_ROWS.toLocaleString('en-US')} rows per campaign` })

  const { campaign } = await loadWorkspace(db, id)
  if (campaign.kind === 'business')
    throw createError({ statusCode: 400, message: 'A business highlight reel is filled in with its form, not a sheet' })
  if (campaign.status !== 'draft')
    throw createError({ statusCode: 409, message: 'This campaign is published. Edit rows in the grid instead, or start a new campaign.' })

  let settings = campaign.settings
  if (body.columns !== undefined) {
    const base = getTemplate(campaign.template_key)
    settings = { ...settings, columns: cleanColumns(body.columns).filter(c => ownKeyOk(c.key, base)), slides: cleanSlides(body.slides) }
    const { error } = await db.from('campaigns').update({ settings: storableSettings(settings) }).eq('id', id)
    if (error)
      dbError(error, 'Saving columns')
  }

  const template = templateFor(campaign.template_key, settings)
  const { missing } = checkHeaders(Object.keys(rows[0] as object), template)
  if (missing.length)
    throw createError({ statusCode: 400, message: `Missing required columns: ${missing.join(', ')}` })

  const idColumn = idColumnOf(template)
  const raws = (rows as Record<string, unknown>[]).map(r => normalizeRaw(r, template))
  const results = validateSheet(raws, template)

  const { error } = await db.from('recipients').delete().eq('campaign_id', id)
  if (error)
    dbError(error, 'Clearing recipients')

  const recipients = await insertRecipients(db, raws.map((raw, i) => ({
    campaign_id: id,
    row_index: i,
    customer_id: raw[idColumn] ?? '',
    first_name: results[i]!.data.first_name,
    email: results[i]!.data.email,
    raw,
    data: results[i]!.data,
    errors: results[i]!.errors,
  })))

  return { recipients, settings }
})
