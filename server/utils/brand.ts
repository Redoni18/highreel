// The business's brand (name, colour, website, logo): the checks shared by
// PATCH /api/business (Your brand, SPEC M2.6) and PATCH /api/campaigns/:id.

import type { H3Event } from 'h3'
import type { Business } from '#shared/types/recap'
import { isHttpUrl, normalizeSettings } from '#shared/utils/recap'
import { signMedia } from './media'

export function checkText(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== 'string')
    throw createError({ statusCode: 400, message: `${field} must be text` })
  const s = value.trim()
  if (required && !s)
    throw createError({ statusCode: 400, message: `${field} is required` })
  if (s.length > max)
    throw createError({ statusCode: 400, message: `${field}: max ${max} characters` })
  return s
}

export function checkUrl(value: unknown, field: string): string {
  const s = checkText(value ?? '', field, 500)
  if (s && !isHttpUrl(s))
    throw createError({ statusCode: 400, message: `${field} must start with https://` })
  return s
}

// No colour: it belongs to a Highreel's design since M2.17.
export interface BrandInput { name?: unknown, website_url?: unknown, logo_path?: unknown, logo_shape?: unknown }

/** The columns to update on `businesses`; throws 400 on anything invalid. Logos must be in the business's own folder. */
export function brandUpdate(b: BrandInput, businessId: string): BusinessUpdate {
  const out: BusinessUpdate = {}
  if (b.name !== undefined)
    out.name = checkText(b.name, 'Business name', 60, true)
  if (b.website_url !== undefined)
    out.website_url = checkUrl(b.website_url, 'Website') || null
  if (b.logo_shape !== undefined) {
    if (b.logo_shape !== 'circle' && b.logo_shape !== 'square')
      throw createError({ statusCode: 400, message: 'Logo shape is circle or square' })
    out.logo_shape = b.logo_shape
  }
  if (b.logo_path !== undefined) {
    if (b.logo_path !== null && (typeof b.logo_path !== 'string' || !b.logo_path.startsWith(`${businessId}/logo/`) || b.logo_path.includes('..')))
      throw createError({ statusCode: 400, message: 'Logo is outside your folder' })
    out.logo_path = b.logo_path as string | null
  }
  return out
}

/** The business with a signed logo URL (1 h), for the workspace. */
export async function signedBusiness(event: H3Event, business: Business): Promise<Business> {
  return (await signMedia(event, business, normalizeSettings({}), 3600)).business
}
