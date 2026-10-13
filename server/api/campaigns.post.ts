// New campaign (SPEC M2b). With a business-type template (`starter`), the
// campaign starts with its wording and theme, and a business that still has
// the default colour takes the template's. The answer carries the business
// too (signed, as the workspace gets it): the workspace opens a new campaign
// with these without asking again (SPEC §7.7).

import type { CreatedCampaign } from '#shared/types/recap'
import { templates } from '#shared/templates'
import { getStarter } from '#shared/templates/starters'
import { DEFAULT_ACCENT } from '../utils/db'

export default defineEventHandler(async (event): Promise<CreatedCampaign> => {
  const { db, business } = await requireUser(event)
  const body = await readBody<{ name?: unknown, year?: unknown, template_key?: unknown, starter?: unknown }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const year = Number(body?.year)
  const starter = typeof body?.starter === 'string' ? getStarter(body.starter) : undefined
  if (body?.starter !== undefined && !starter)
    throw createError({ statusCode: 400, message: 'Unknown template' })
  const templateKey = starter?.template ?? (typeof body?.template_key === 'string' ? body.template_key : 'app')
  if (!name || name.length > 80)
    throw createError({ statusCode: 400, message: 'Name: 1–80 characters' })
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw createError({ statusCode: 400, message: 'Year must be like 2026' })
  if (!templates[templateKey])
    throw createError({ statusCode: 400, message: 'Unknown template' })
  if (starter && business.accent_color.toUpperCase() === DEFAULT_ACCENT && starter.accent !== DEFAULT_ACCENT)
    await updateBusiness(db, { accent_color: starter.accent })
  const created = await createCampaign(db, { name, year, template_key: templateKey, starter })
  const ws = await loadSignedWorkspace(event, db, created.id)
  return { ...ws.campaign, business: ws.business }
})
