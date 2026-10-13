// Encrypting what businesses give us to send on their behalf (SPEC M2.9: SMTP
// passwords and API keys). AES-256-GCM with Web Crypto (runs on Node and on
// Cloudflare). The key is NUXT_SECRETS_KEY; a development server without one
// uses a fixed stand-in so local work just runs, and a production server
// without one refuses rather than store anything weakly.
// Media links are signed with a key derived from the same secret (media.ts).

import type { H3Event } from 'h3'

const VERSION = 'v1'
const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'))

let cached: { from: string, key: Promise<CryptoKey> } | null = null

/** The server's secret (NUXT_SECRETS_KEY), or a development stand-in. */
export function secretMaterial(event: H3Event): string {
  const configured = String(useRuntimeConfig(event).secretsKey || '')
  if (configured)
    return configured
  if (!import.meta.dev)
    throw createError({ statusCode: 500, message: 'NUXT_SECRETS_KEY isn\'t set on the server' })
  return 'highreel-dev:local'
}

function keyFor(event: H3Event): Promise<CryptoKey> {
  const material = secretMaterial(event)
  if (cached?.from !== material) {
    cached = {
      from: material,
      key: crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
        .then(hash => crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])),
    }
  }
  return cached.key
}

export async function encryptSecret(event: H3Event, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(event), new TextEncoder().encode(plain))
  return `${VERSION}:${b64(iv)}:${b64(new Uint8Array(sealed))}`
}

export async function decryptSecret(event: H3Event, sealed: string): Promise<string> {
  if (!sealed)
    return ''
  const [version, iv, data] = sealed.split(':')
  if (version !== VERSION || !iv || !data)
    throw createError({ statusCode: 500, message: 'Unreadable saved password: connect your email again' })
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await keyFor(event), unb64(data))
    return new TextDecoder().decode(plain)
  }
  catch {
    throw createError({ statusCode: 500, message: 'The saved password can\'t be read any more (the server\'s key changed): connect your email again' })
  }
}
