// Mail-merge CSV of the published links: the id column, first_name, email,
// link. The business sends these with its own email tool (SPEC §3). Streamed
// a page of rows at a time (SPEC M2.14 P1).

import { getTemplate, idColumnOf } from '#shared/templates'

function cell(value: unknown): string {
  let s = typeof value === 'string' ? value : value == null ? '' : String(value)
  // Spreadsheet apps run cells that start with these as formulas.
  if (/^[=+\-@\t\r]/.test(s))
    s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'highreels'
}

export default defineEventHandler(async (event) => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { business, campaign } = await loadWorkspace(db, id)
  if (campaign.kind === 'business')
    throw createError({ statusCode: 400, message: 'A business Highreel has one link: copy it from its page' })
  const origin = siteOrigin(event)

  const filename = `${slug(business.name)}-${slug(campaign.name)}-links.csv`
  setResponseHeaders(event, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  })
  const encoder = new TextEncoder()
  let after: number | null = -1
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`${idColumnOf(getTemplate(campaign.template_key))},first_name,email,link\n`))
    },
    async pull(controller) {
      if (after === null) {
        controller.close()
        return
      }
      const rows = await linkRows(db, id, after)
      if (rows.length)
        controller.enqueue(encoder.encode(rows.map(r => `${[cell(r.customer_id), cell(r.first_name), cell(r.email), cell(`${origin}/r/${r.token}`)].join(',')}\n`).join('')))
      after = rows.length === PAGE_ROWS ? rows.at(-1)!.row_index : null
    },
  })
})
