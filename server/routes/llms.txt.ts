// /llms.txt (llmstxt.org), prerendered: Highreel in plain Markdown for AI
// assistants and their crawlers, from the landing's own words
// (app/data/landing.ts), so it never says more than the page does.
import { EXAMPLES } from '~/data/examples'
import { CONTACT_EMAIL } from '~/data/legal'
import { FAQS, INCLUDES, LANDING_AUDIENCE, LANDING_DESCRIPTION, LANDING_LEDE, PRICING_LEAD, STEPS, TIERS } from '~/data/landing'

export default defineEventHandler((event) => {
  const origin = useRuntimeConfig(event).public.siteOrigin.replace(/\/$/, '')
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return [
    '# Highreel',
    '',
    `> ${LANDING_DESCRIPTION}`,
    '',
    LANDING_LEDE,
    '',
    `Who it's for: ${LANDING_AUDIENCE}`,
    '',
    '## How it works',
    '',
    ...STEPS.map((s, i) => `${i + 1}. **${s.title}** ${s.body}`),
    '',
    '## Pricing',
    '',
    `One price for the whole campaign. ${PRICING_LEAD}`,
    '',
    ...TIERS.map(t => `- Up to ${t.size} customers: ${t.price} for the whole campaign${t.founding && t.was ? ` (founding price; usually ${t.was})` : ''}`),
    '',
    'Every campaign includes:',
    '',
    ...INCLUDES.map(c => `- **${c.title}.** ${c.body}`),
    '',
    '## FAQ',
    '',
    ...FAQS.flatMap(f => [`### ${f.q}`, '', f.a, '']),
    '## Examples',
    '',
    ...EXAMPLES.map(e => `- [${e.label}](${origin}/example/${e.key}): ${e.about}`),
    '',
    '## Links',
    '',
    `- [Home](${origin}/): what Highreel is, examples, pricing and questions`,
    `- [Try the demo](${origin}/login?demo=1): the whole thing with sample data, no account needed`,
    `- [Terms of service](${origin}/terms)`,
    `- [Privacy policy](${origin}/privacy)`,
    `- Contact: ${CONTACT_EMAIL}`,
    '',
  ].join('\n')
})
