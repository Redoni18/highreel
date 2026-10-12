import { appTemplate } from './app'
import { businessTemplate } from './business'
import { customTemplate } from './custom'
import { newsletterTemplate } from './newsletter'
import { type OwnSettings, withOwn } from './own'
import { shopTemplate } from './shop'
import type { Template } from './types'
import { visitTemplate } from './visit'

export const templates: Record<string, Template> = {
  app: appTemplate,
  newsletter: newsletterTemplate,
  shop: shopTemplate,
  visit: visitTemplate,
  custom: customTemplate,
  business: businessTemplate,
}

/** Templates for a recap per customer (a sheet), the default kind. */
export const customerTemplates: Template[] = Object.values(templates).filter(t => (t.kind ?? 'customers') === 'customers')

export function getTemplate(key: string): Template {
  return templates[key] ?? appTemplate
}

/**
 * A campaign's effective template (SPEC M2.7): its template plus the
 * business's own columns and slide list from the campaign settings. Use this
 * wherever a campaign or a recap payload is at hand; getTemplate() is the
 * template alone.
 */
export function templateFor(key: string, settings?: OwnSettings | null): Template {
  return withOwn(getTemplate(key), settings)
}

/** The column that identifies a customer (customer_id, subscriber_id, participant_id). */
export function idColumnOf(template: Template): string {
  return template.columns.find(c => c.unique)?.key ?? template.columns[0]!.key
}

/** Copy keys a campaign may override: the cover and each slide. */
export function copyKeysOf(template: Template): string[] {
  return ['cover', ...template.slides.map(s => s.key)]
}
