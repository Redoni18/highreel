interface Rule { path: string, lines: string[] }

/** Whether rule path `a` applies to everything rule path `b` does ("/_nuxt/*" covers "/_nuxt/builds/*"). */
function covers(a: string, b: string): boolean {
  return a === b || (a.endsWith('/*') && b.startsWith(a.slice(0, -1)))
}

const depth = (path: string) => path.split(/\/(?!\*)/).length
const headerName = (line: string) => /^\s+([^!\s][^:]*):/.exec(line)?.[1]?.trim().toLowerCase()

/**
 * Cloudflare applies every `_headers` rule that matches a path and joins
 * their values: Nuxt's `/_nuxt/**` (a year) and `/_nuxt/builds/**` (a
 * second) gave latest.json "max-age=1, immutable, public, max-age=31536000".
 * A rule's `! name` drops what rules before it set, so: general rules first,
 * and a more specific rule detaches each header it sets again.
 */
export function orderHeaders(contents: string): string {
  const rules: Rule[] = []
  for (const line of contents.split('\n')) {
    if (!line.trim())
      continue
    // Detach lines are recomputed below (a second run changes nothing).
    if (/^\s+!/.test(line))
      continue
    if (/^\s/.test(line))
      rules.at(-1)?.lines.push(line)
    else
      rules.push({ path: line.trim(), lines: [] })
  }
  // Stable: rules of the same depth keep their order.
  const sorted = rules.map((r, i) => ({ r, i })).sort((a, b) => depth(a.r.path) - depth(b.r.path) || a.i - b.i).map(x => x.r)
  return sorted.map((rule, i) => {
    const earlier = new Set(sorted.slice(0, i).filter(r => covers(r.path, rule.path)).flatMap(r => r.lines.map(headerName)).filter(Boolean))
    const detach = [...new Set(rule.lines.map(headerName).filter(n => n && earlier.has(n)))].map(n => `  ! ${n}`)
    return [rule.path, ...detach, ...rule.lines].join('\n')
  }).join('\n')
}
