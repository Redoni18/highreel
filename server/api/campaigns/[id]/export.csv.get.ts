// Mail-merge CSV of the published links: customer_id, first_name, email,
// recap_url. The business sends these with its own email tool (SPEC §3).

import { getTemplate, idColumnOf } from '#shared/templates'
import { hasErrors } from '#shared/utils/validate'

function cell(value: string | null | undefined): string {
  let s = value ?? ''
  // Spreadsheet apps run cells that start with these as formulas.
  if (/^[=+\-@\t\r]/.test(s))
    s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'highlight-reels'
}

export default defineEventHandler(async (event) => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { business, campaign } = await loadWorkspace(db, id)
  if (campaign.kind === 'business')
    throw createError({ statusCode: 400, message: 'A business highlight reel has one link: copy it from its page' })
  const rows = await loadRecipients(db, id)
  const origin = useRuntimeConfig(event).public.siteUrl || getRequestURL(event).origin

  const lines = [`${idColumnOf(getTemplate(campaign.template_key))},first_name,email,link`]
  for (const row of rows) {
    if (!row.token || hasErrors(row.errors))
      continue
    lines.push([
      cell(row.customer_id),
      cell(row.data.first_name as string | null),
      cell(row.data.email as string | null),
      cell(`${origin}/r/${row.token}`),
    ].join(','))
  }

  const filename = `${slug(business.name)}-${slug(campaign.name)}-links.csv`
  setResponseHeaders(event, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  })
  return `${lines.join('\n')}\n`
})
