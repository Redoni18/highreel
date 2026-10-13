// The site's wordmark and tab icon (SPEC §6.4): runs the checks for the logo
// LOGO picks (app/data/brand.ts), wordmark-highlighter.mjs or
// wordmark-capital-h.mjs, so switching logos needs no change here.
const { LOGO } = await import('../../app/data/brand.ts')
await import(`./wordmark-${LOGO}.mjs`)
